import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { WebhookSubscription } from './webhook-subscription.entity';

@Entity('webhook_deliveries')
export class WebhookDelivery {
  @PrimaryColumn({ type: 'char', length: 36 })
  id: string;

  @Column({ name: 'subscription_id', type: 'char', length: 36 })
  subscriptionId: string;

  @Column({ name: 'document_id', type: 'char', length: 36 })
  documentId: string;

  @Column({ name: 'tenant_id', type: 'char', length: 36 })
  tenantId: string;

  @Column({ name: 'event_type', length: 60 })
  eventType: string;

  @Column({ type: 'json' })
  payload: Record<string, any>;

  @Column({
    type: 'enum',
    enum: ['pending', 'delivered', 'failed'],
    default: 'pending',
  })
  status: 'pending' | 'delivered' | 'failed';

  @Column({ name: 'http_status', nullable: true, type: 'int' })
  httpStatus: number | null;

  @Column({ name: 'response_body', type: 'text', nullable: true })
  responseBody: string | null;

  @Column({ default: 0 })
  attempts: number;

  @Column({ name: 'last_attempt_at', type: 'timestamp', nullable: true })
  lastAttemptAt: Date | null;

  @ManyToOne(() => WebhookSubscription, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'subscription_id' })
  subscription: WebhookSubscription;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
