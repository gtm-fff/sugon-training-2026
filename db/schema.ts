import { integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const submissions = sqliteTable(
  'submissions',
  {
    id: text('id').primaryKey(),
    credentialHash: text('credential_hash').notNull(),
    company: text('company').notNull(),
    title: text('title').notNull().default(''),
    description: text('description').notNull().default(''),
    imageKey: text('image_key').notNull(),
    imageName: text('image_name').notNull(),
    imageType: text('image_type').notNull(),
    imageSize: integer('image_size').notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    uniqueIndex('idx_submissions_credential_hash').on(table.credentialHash),
  ],
);
