"""add company to users and buses, drop managed_by FK

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-03-24 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'b2c3d4e5f6a7'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None


def upgrade():
    # Add company column to users
    op.add_column('users', sa.Column('company', sa.String(100), nullable=True))

    # Replace managed_by (UUID FK) with company (string) on buses
    op.drop_constraint('fk_buses_managed_by_users', 'buses', type_='foreignkey')
    op.drop_column('buses', 'managed_by')
    op.add_column('buses', sa.Column('company', sa.String(100), nullable=True))


def downgrade():
    # Revert buses: drop company, re-add managed_by
    op.drop_column('buses', 'company')
    op.add_column('buses', sa.Column('managed_by', sa.UUID(), nullable=True))
    op.create_foreign_key(
        'fk_buses_managed_by_users', 'buses', 'users',
        ['managed_by'], ['id'], ondelete='SET NULL'
    )

    # Remove company from users
    op.drop_column('users', 'company')
