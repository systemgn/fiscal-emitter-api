import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { FiscalDocument } from './fiscal-document.entity';

export type EventType =
  | 'emission_requested'
  | 'processing'
  | 'issued'
  | 'error'
  | 'cancelled'
  | 'export_requested'
  | 'retry';

@Entity('fiscal_document_events')
export class FiscalDocumentEvent {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'document_id', type: 'char', length: 36 })
  documentId: string;

  @Column({ name: 'tenant_id', type: 'char', length: 36 })
  tenantId: string;

  @Column({ name: 'event_type', length: 60 })
  eventType: EventType;

  @Column({ name: 'status_from', length: 30, nullable: true })
  statusFrom: string | null;

  @Column({ name: 'status_to', length: 30, nullable: true })
  statusTo: string | null;

  @Column({ type: 'text', nullable: true })
  message: string | null;

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, any> | null;

  @ManyToOne(() => FiscalDocument, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'document_id' })
  document: FiscalDocument;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
