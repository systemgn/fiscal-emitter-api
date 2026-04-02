import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Tenant } from './tenant.entity';

@Entity('tenant_credentials')
export class TenantCredential {
  @PrimaryColumn({ type: 'char', length: 36 })
  id: string;

  @Column({ name: 'tenant_id', type: 'char', length: 36 })
  tenantId: string;

  @Column({ type: 'enum', enum: ['sandbox', 'production'], default: 'sandbox' })
  environment: 'sandbox' | 'production';

  @Column({ name: 'certificate_pfx', type: 'blob', nullable: true })
  certificatePfx: Buffer | null;

  @Column({ name: 'certificate_password', length: 255, nullable: true })
  certificatePassword: string | null;

  @Column({ name: 'certificate_expires_at', type: 'date', nullable: true })
  certificateExpiresAt: Date | null;

  @Column({ name: 'access_token', type: 'text', nullable: true })
  accessToken: string | null;

  @Column({ name: 'token_expires_at', type: 'timestamp', nullable: true })
  tokenExpiresAt: Date | null;

  /** clientId + clientSecret para OAuth, ibgeCode do município, etc. */
  @Column({ name: 'extra_config', type: 'json', nullable: true })
  extraConfig: Record<string, any> | null;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
