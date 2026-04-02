import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

export type TenantStatus = 'active' | 'inactive' | 'suspended';

@Entity('tenants')
export class Tenant {
  @PrimaryColumn({ type: 'char', length: 36 })
  id: string;

  @Column({ length: 255 })
  name: string;

  @Column({ length: 14, unique: true })
  document: string;

  @Column({ length: 191, unique: true })
  email: string;

  @Column({
    type: 'enum',
    enum: ['active', 'inactive', 'suspended'],
    default: 'active',
  })
  status: TenantStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
