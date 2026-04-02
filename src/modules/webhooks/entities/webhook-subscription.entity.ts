import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Tenant } from '../../tenants/entities/tenant.entity';

export type WebhookEvent =
  | 'document.issued'
  | 'document.rejected'
  | 'document.cancelled'
  | 'document.error'
  | 'export.ready';

@Entity('webhook_subscriptions')
export class WebhookSubscription {
  @PrimaryColumn({ type: 'char', length: 36 })
  id: string;

  @Column({ name: 'tenant_id', type: 'char', length: 36 })
  tenantId: string;

  @Column({ length: 100 })
  name: string;

  @Column({ length: 500 })
  url: string;

  /** Segredo usado para assinar o payload via HMAC-SHA256 */
  @Column({ length: 64 })
  secret: string;

  /**
   * Lista de eventos subscritos.
   * Exemplo: ["document.issued","document.cancelled"]
   */
  @Column({ type: 'json' })
  events: WebhookEvent[];

  @Column({ type: 'enum', enum: ['active', 'inactive'], default: 'active' })
  status: 'active' | 'inactive';

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
