import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import * as forge from 'node-forge';
import { TenantCredential } from './entities/tenant-credential.entity';
import { UpsertCredentialDto } from './dtos/upsert-credential.dto';
import { TenantsService } from './tenants.service';

@Injectable()
export class CredentialsService {
  private readonly logger = new Logger(CredentialsService.name);

  constructor(
    @InjectRepository(TenantCredential)
    private readonly credRepo: Repository<TenantCredential>,
    private readonly tenantsService: TenantsService,
  ) {}

  async upsert(tenantId: string, dto: UpsertCredentialDto): Promise<Omit<TenantCredential, 'certificatePfx'>> {
    await this.tenantsService.findOne(tenantId); // garante que tenant existe

    let pfxBuffer: Buffer | null = null;
    let expiresAt: Date | null   = null;

    if (dto.certificatePfxBase64) {
      pfxBuffer = this.decodePfx(dto.certificatePfxBase64, dto.certificatePassword ?? '');
      expiresAt = dto.certificateExpiresAt
        ? new Date(dto.certificateExpiresAt)
        : this.extractExpiryFromPfx(pfxBuffer, dto.certificatePassword ?? '');
    }

    const existing = await this.credRepo.findOne({
      where: { tenantId, environment: dto.environment },
    });

    if (existing) {
      await this.credRepo.update(existing.id, {
        certificatePfx:       pfxBuffer        ?? existing.certificatePfx,
        certificatePassword:   dto.certificatePassword  ?? existing.certificatePassword,
        certificateExpiresAt:  expiresAt        ?? existing.certificateExpiresAt,
        extraConfig:           dto.extraConfig  ?? existing.extraConfig,
        // Invalida token ao trocar certificado
        accessToken:           pfxBuffer ? null : existing.accessToken,
        tokenExpiresAt:        pfxBuffer ? null : existing.tokenExpiresAt,
      });
      return this.findSafe(tenantId, dto.environment);
    }

    const cred = this.credRepo.create({
      id:                   uuidv4(),
      tenantId,
      environment:          dto.environment,
      certificatePfx:       pfxBuffer,
      certificatePassword:  dto.certificatePassword ?? null,
      certificateExpiresAt: expiresAt,
      extraConfig:          dto.extraConfig ?? null,
    });
    await this.credRepo.save(cred);
    return this.findSafe(tenantId, dto.environment);
  }

  async findByTenant(tenantId: string): Promise<Omit<TenantCredential, 'certificatePfx'>[]> {
    const creds = await this.credRepo.find({ where: { tenantId } });
    return creds.map(({ certificatePfx: _, certificatePassword: __, ...safe }) => safe as any);
  }

  async findSafe(
    tenantId: string,
    environment: 'sandbox' | 'production',
  ): Promise<Omit<TenantCredential, 'certificatePfx'>> {
    const cred = await this.credRepo.findOne({ where: { tenantId, environment } });
    if (!cred) throw new NotFoundException(`Credentials for ${environment} not found`);
    const { certificatePfx: _, certificatePassword: __, ...safe } = cred;
    return {
      ...safe,
      // Informa apenas se há certificado, sem expor os bytes
      certificatePfx: (cred.certificatePfx ? '[PRESENT]' : null) as any,
      certificatePassword: (cred.certificatePassword ? '[MASKED]' : null) as any,
    };
  }

  async delete(tenantId: string, environment: 'sandbox' | 'production'): Promise<void> {
    const cred = await this.credRepo.findOne({ where: { tenantId, environment } });
    if (!cred) throw new NotFoundException(`Credentials for ${environment} not found`);
    await this.credRepo.remove(cred);
    this.logger.log(`Credentials deleted for tenant=${tenantId} env=${environment}`);
  }

  // ── Helpers ───────────────────────────────────────────────────────

  private decodePfx(base64: string, password: string): Buffer {
    let buf: Buffer;
    try {
      buf = Buffer.from(base64, 'base64');
    } catch {
      throw new BadRequestException('certificatePfxBase64 is not valid Base64');
    }

    // Valida que é um PFX real tentando parsear
    try {
      const asn1 = forge.asn1.fromDer(forge.util.createBuffer(buf.toString('binary')));
      forge.pkcs12.pkcs12FromAsn1(asn1, password);
    } catch {
      throw new BadRequestException(
        'Invalid PFX certificate or wrong password. Check the file and certificatePassword.',
      );
    }

    return buf;
  }

  private extractExpiryFromPfx(pfxBuffer: Buffer, password: string): Date | null {
    try {
      const asn1 = forge.asn1.fromDer(
        forge.util.createBuffer(pfxBuffer.toString('binary')),
      );
      const p12  = forge.pkcs12.pkcs12FromAsn1(asn1, password);
      const bags  = p12.getBags({ bagType: forge.pki.oids.certBag });
      const cert  = bags[forge.pki.oids.certBag]?.[0]?.cert;
      return cert ? cert.validity.notAfter : null;
    } catch {
      return null;
    }
  }
}
