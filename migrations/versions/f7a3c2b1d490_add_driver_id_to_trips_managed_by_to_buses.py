"""add driver_id to trips and managed_by to buses

Revision ID: f7a3c2b1d490
Revises: eae9c583f976
Create Date: 2026-03-19 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = 'f7a3c2b1d490'
down_revision = 'eae9c583f976'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('trips', sa.Column('driver_id', postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key(
        'fk_trips_driver_id_users', 'trips', 'users',
        ['driver_id'], ['id'], ondelete='SET NULL'
    )

    op.add_column('buses', sa.Column('managed_by', postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key(
        'fk_buses_managed_by_users', 'buses', 'users',
        ['managed_by'], ['id'], ondelete='SET NULL'
    )


def downgrade():
    op.drop_constraint('fk_trips_driver_id_users', 'trips', type_='foreignkey')
    op.drop_column('trips', 'driver_id')

    op.drop_constraint('fk_buses_managed_by_users', 'buses', type_='foreignkey')
    op.drop_column('buses', 'managed_by')
