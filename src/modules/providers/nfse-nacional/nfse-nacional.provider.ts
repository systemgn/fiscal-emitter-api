import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios, { AxiosInstance } from 'axios';
import * as https from 'https';
import * as forge from 'node-forge';
import {
  CancelPayload,
  CancelResult,
  EmitPayload,
  EmitResult,
  ExportPayload,
  ExportResult,
  FiscalProvider,
  StatusPayload,
  StatusResult,
} from '../fiscal-provider.interface';
import { classifyNfseError, shouldRetry } from './nfse-error-codes';

// Entidade inline de credenciais por tenant
import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('tenant_credentials')
class TenantCredential {
  @PrimaryColumn({ type: 'char', length: 36 }) id: string;
  @Column({ name: 'tenant_id', type: 'char', length: 36 }) tenantId: string;
  @Column() environment: string;
  @Column({ name: 'certificate_pfx', type: 'blob', nullable: true }) certificatePfx: Buffer | null;
  @Column({ name: 'certificate_password', nullable: true }) certificatePassword: string | null;
  @Column({ name: 'access_token', type: 'text', nullable: true }) accessToken: string | null;
  @Column({ name: 'token_expires_at', type: 'timestamp', nullable: true }) tokenExpiresAt: Date | null;
  @Column({ name: 'extra_config', type: 'json', nullable: true }) extraConfig: Record<string, any> | null;
}

/**
 * NfseNacionalProvider — integração real com a NFS-e Nacional (SEFAZ).
 *
 * Documentação oficial: https://www.gov.br/nfse/pt-br
 * Autenticação: Certificado A1 (mTLS) + Bearer token OAuth
 *
 * Fluxo:
 *  1. Carrega PFX do banco (tenant_credentials)
 *  2. Cria httpsAgent com certificado para mTLS
 *  3. Obtém token OAuth via /oauth/token (client_credentials)
 *  4. Chama endpoints REST da NFS-e Nacional
 */
@Injectable()
export class NfseNacionalProvider implements FiscalProvider {
  private readonly logger = new Logger(NfseNacionalProvider.name);

  // Cache de tokens por tenant+environment para evitar refresh desnecessário
  private readonly tokenCache = new Map<
    string,
    { token: string; expiresAt: Date }
  >();

  constructor(
    @InjectRepository(TenantCredential)
    private readonly credRepo: Repository<TenantCredential>,
    private readonly config: ConfigService,
  ) {}

  // ──────────────────────────────────────────────────────────────────
  // EMIT
  // ──────────────────────────────────────────────────────────────────
  async emit(payload: EmitPayload): Promise<EmitResult> {
    const client = await this.buildClient(payload.tenantId, payload.environment);

    const body = this.buildEmitBody(payload);

    try {
      const start = Date.now();
      const res = await client.post('/v1/nfse', body);
      this.logger.debug(`emit OK [${Date.now() - start}ms]`);

      const data = res.data;
      return {
        success: true,
        nfseNumber:   data.numeroNfse ?? data.nfseNumber,
        nfseCode:     data.codigoVerificacao ?? data.verificationCode,
        nfseIssuedAt: data.dataEmissao ? new Date(data.dataEmissao) : new Date(),
        rpsNumber:    payload.rps?.number,
        rpsSeries:    payload.rps?.series,
        rawResponse:  this.sanitizeResponse(data),
      };
    } catch (err: any) {
      return this.handleProviderError(err, 'emit');
    }
  }

  // ──────────────────────────────────────────────────────────────────
  // CANCEL
  // ──────────────────────────────────────────────────────────────────
  async cancel(payload: CancelPayload): Promise<CancelResult> {
    const client = await this.buildClient(payload.tenantId, payload.environment);

    try {
      const res = await client.delete(`/v1/nfse/${payload.nfseNumber}`, {
        data: { motivoCancelamento: payload.reason },
      });
      return {
        success: true,
        cancelledAt: new Date(),
        rawResponse: this.sanitizeResponse(res.data),
      };
    } catch (err: any) {
      return this.handleCancelError(err);
    }
  }

  // ──────────────────────────────────────────────────────────────────
  // GET STATUS
  // ──────────────────────────────────────────────────────────────────
  async getStatus(payload: StatusPayload): Promise<StatusResult> {
    const client = await this.buildClient(payload.tenantId, payload.environment);

    try {
      const res = await client.get(`/v1/nfse/${payload.nfseNumber}`);
      const status = this.mapNfseStatus(res.data.situacao ?? res.data.status);
      return { status, rawResponse: this.sanitizeResponse(res.data) };
    } catch (err: any) {
      return { status: 'error', rawResponse: { error: err.message } };
    }
  }

  // ──────────────────────────────────────────────────────────────────
  // EXPORT (XML / PDF)
  // ──────────────────────────────────────────────────────────────────
  async export(payload: ExportPayload): Promise<ExportResult> {
    const client = await this.buildClient(payload.tenantId, payload.environment);
    const format = payload.type === 'pdf' ? 'pdf' : 'xml';

    try {
      const res = await client.get(
        `/v1/nfse/${payload.nfseNumber}/download?formato=${format}`,
      );
      // A NFS-e Nacional retorna uma URL presigned ou o conteúdo inline
      const downloadUrl: string =
        res.data.url ?? res.data.downloadUrl ?? res.data.link;

      const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 min

      return { success: true, downloadUrl, urlExpiresAt: expiresAt };
    } catch (err: any) {
      return {
        success: false,
        errorCode: 'EXPORT_ERROR',
        errorMessage: err.message,
      };
    }
  }

  // ──────────────────────────────────────────────────────────────────
  // HELPERS PRIVADOS
  // ──────────────────────────────────────────────────────────────────

  /** Constrói o AxiosInstance com mTLS + Bearer token para o tenant */
  private async buildClient(
    tenantId: string,
    environment: string,
  ): Promise<AxiosInstance> {
    const baseURL =
      environment === 'production'
        ? this.config.get<string>('nfse.productionUrl')
        : this.config.get<string>('nfse.sandboxUrl');

    const cred = await this.credRepo.findOne({
      where: { tenantId, environment },
    });

    let httpsAgent: https.Agent | undefined;

    if (cred?.certificatePfx) {
      httpsAgent = this.buildMtlsAgent(cred.certificatePfx, cred.certificatePassword ?? '');
    }

    const token = await this.getToken(tenantId, environment, cred, httpsAgent, baseURL);

    return axios.create({
      baseURL,
      timeout: 30_000,
      httpsAgent,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    });
  }

  /** Cria httpsAgent com certificado PFX para mutual TLS */
  private buildMtlsAgent(pfxBuffer: Buffer, password: string): https.Agent {
    const p12Asn1 = forge.asn1.fromDer(
      forge.util.createBuffer(pfxBuffer.toString('binary')),
    );
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password);

    const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
    const keyBags  = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });

    const cert = certBags[forge.pki.oids.certBag]?.[0]?.cert;
    const key  = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0]?.key;

    if (!cert || !key) {
      throw new Error('Invalid PFX certificate: could not extract cert/key');
    }

    return new https.Agent({
      cert: forge.pki.certificateToPem(cert),
      key:  forge.pki.privateKeyToPem(key),
      rejectUnauthorized: true,
    });
  }

  /** Gerencia token OAuth com cache em memória (vive até expirar) */
  private async getToken(
    tenantId: string,
    environment: string,
    cred: TenantCredential | null,
    httpsAgent: https.Agent | undefined,
    baseURL: string,
  ): Promise<string> {
    const cacheKey = `${tenantId}:${environment}`;
    const cached = this.tokenCache.get(cacheKey);

    // Usa cache se ainda válido com 60s de folga
    if (cached && cached.expiresAt > new Date(Date.now() + 60_000)) {
      return cached.token;
    }

    // Token salvo no banco ainda válido
    if (cred?.accessToken && cred.tokenExpiresAt && cred.tokenExpiresAt > new Date()) {
      this.tokenCache.set(cacheKey, {
        token: cred.accessToken,
        expiresAt: cred.tokenExpiresAt,
      });
      return cred.accessToken;
    }

    // Solicita novo token via OAuth client_credentials
    const tokenRes = await axios.post(
      `${baseURL}/oauth/token`,
      new URLSearchParams({
        grant_type:    'client_credentials',
        client_id:     cred?.extraConfig?.['clientId']     ?? '',
        client_secret: cred?.extraConfig?.['clientSecret'] ?? '',
      }).toString(),
      {
        httpsAgent,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 15_000,
      },
    );

    const token     = tokenRes.data.access_token as string;
    const expiresIn = (tokenRes.data.expires_in as number) ?? 3600;
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    this.tokenCache.set(cacheKey, { token, expiresAt });

    // Persiste token no banco para sobreviver restart do worker
    if (cred) {
      await this.credRepo.update(cred.id, { accessToken: token, tokenExpiresAt: expiresAt });
    }

    return token;
  }

  /** Constrói o body de emissão conforme spec NFS-e Nacional */
  private buildEmitBody(p: EmitPayload): Record<string, any> {
    return {
      prestador: {
        cpfCnpj: p.providerCnpj,
        nomeRazaoSocial: p.providerName,
      },
      tomador: {
        cpfCnpj:        p.taker.document,
        tipoDocumento:  p.taker.documentType.toUpperCase(),
        nomeRazaoSocial: p.taker.name,
        email:          p.taker.email,
        endereco: p.taker.address
          ? {
              logradouro:  p.taker.address.street,
              numero:      p.taker.address.number,
              complemento: p.taker.address.complement,
              bairro:      p.taker.address.district,
              codigoMunicipio: p.taker.address.cityCode,
              uf:          p.taker.address.state,
              cep:         p.taker.address.zipCode,
            }
          : undefined,
      },
      servico: {
        codigo:      p.service.code,
        descricao:   p.service.description,
        valor:       p.service.amount,
        deducoes:    p.service.taxes?.deductions ?? 0,
        aliquotaIss: p.service.taxes?.issRate    ?? 0,
        // IssRetido: 1=Sim (tomador retém), 2=Não — padrão NFS-e Nacional
        issRetido:   p.service.taxes?.issWithheld ? 1 : 2,
        valorPis:    p.service.taxes?.pisAmount   ?? 0,
        valorCofins: p.service.taxes?.cofinsAmount ?? 0,
        valorIr:     p.service.taxes?.irAmount    ?? 0,
        valorCsll:   p.service.taxes?.csllAmount  ?? 0,
        valorInss:   p.service.taxes?.inssAmount  ?? 0,
      },
      rps: {
        numero: p.rps?.number,
        serie:  p.rps?.series ?? 'A',
        tipo:   p.rps?.type   ?? 'RPS',
      },
    };
  }

  private mapNfseStatus(raw: string): StatusResult['status'] {
    const map: Record<string, StatusResult['status']> = {
      EMITIDA:     'issued',
      CANCELADA:   'cancelled',
      PROCESSANDO: 'processing',
      ERRO:        'error',
      ISSUED:      'issued',
      CANCELLED:   'cancelled',
    };
    return map[raw?.toUpperCase()] ?? 'error';
  }

  /** Remove campos binários da resposta antes de gravar no banco */
  private sanitizeResponse(data: any): Record<string, any> {
    const { xml, pdf, conteudo, ...safe } = data ?? {};
    return safe;
  }

  private handleProviderError(err: any, op: string): EmitResult {
    const httpStatus = err.response?.status;
    const body       = err.response?.data;

    if (httpStatus && httpStatus < 500) {
      const code    = body?.codigo ?? body?.code ?? 'NFSE_ERROR';
      const message = body?.mensagem ?? body?.message ?? err.message;
      const def     = classifyNfseError(code);

      this.logger.warn(`[${op}] SEFAZ error ${code} (${def.category}): ${message}`);

      if (!shouldRetry(code)) {
        // Erro de negócio — não retentar, retorna failure
        return {
          success:      false,
          errorCode:    code,
          errorMessage: def.userMessage || message,
          rawResponse:  this.sanitizeResponse(body),
        };
      }
    }

    // Erro técnico (5xx, timeout, rede) → relança para BullMQ retentar
    this.logger.error(`[${op}] Technical error: ${err.message}`);
    throw err;
  }

  private handleCancelError(err: any): CancelResult {
    const body = err.response?.data;
    const code = body?.codigo ?? body?.code ?? 'CANCEL_ERROR';
    const def  = classifyNfseError(code);

    if (!shouldRetry(code)) {
      return {
        success:      false,
        errorCode:    code,
        errorMessage: def.userMessage || body?.mensagem || err.message,
        rawResponse:  this.sanitizeResponse(body),
      };
    }

    // Erro técnico → relança para retry
    throw err;
  }
}
