-- Remove the stored quad paper and every figure stored for it.
-- Idempotent: deleting rows that are already gone does nothing.
-- Other documents, if any, stay. The tables stay.
delete from document_assets where slug = 'quad-strategy';
delete from documents where slug = 'quad-strategy';
