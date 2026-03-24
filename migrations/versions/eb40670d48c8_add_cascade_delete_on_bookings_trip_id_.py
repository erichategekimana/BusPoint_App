"""add cascade delete on bookings.trip_id FK

Revision ID: eb40670d48c8
Revises: f7a3c2b1d490
Create Date: 2026-03-21 13:18:04.403998

"""
from alembic import op

# revision identifiers, used by Alembic.
revision = 'eb40670d48c8'
down_revision = 'f7a3c2b1d490'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('bookings', schema=None) as batch_op:
        batch_op.drop_constraint('bookings_trip_id_fkey', type_='foreignkey')
        batch_op.create_foreign_key('bookings_trip_id_fkey', 'trips', ['trip_id'], ['id'], ondelete='CASCADE')


def downgrade():
    with op.batch_alter_table('bookings', schema=None) as batch_op:
        batch_op.drop_constraint('bookings_trip_id_fkey', type_='foreignkey')
        batch_op.create_foreign_key('bookings_trip_id_fkey', 'trips', ['trip_id'], ['id'])
