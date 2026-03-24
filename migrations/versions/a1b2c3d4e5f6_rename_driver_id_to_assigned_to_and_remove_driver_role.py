"""rename driver_id to assigned_to and remove driver role

Revision ID: a1b2c3d4e5f6
Revises: eb40670d48c8
Create Date: 2026-03-24 00:00:00.000000

"""
from alembic import op


# revision identifiers, used by Alembic.
revision = 'a1b2c3d4e5f6'
down_revision = 'eb40670d48c8'
branch_labels = None
depends_on = None


def upgrade():
    # Rename column driver_id -> assigned_to on trips table
    op.alter_column('trips', 'driver_id', new_column_name='assigned_to')

    # Rename the foreign key constraint to match
    op.drop_constraint('fk_trips_driver_id_users', 'trips', type_='foreignkey')
    op.create_foreign_key(
        'fk_trips_assigned_to_users', 'trips', 'users',
        ['assigned_to'], ['id'], ondelete='SET NULL'
    )

    # Migrate existing driver users to admin role
    op.execute("UPDATE users SET role = 'admin' WHERE role = 'driver'")


def downgrade():
    # Revert admin users that were drivers back to driver role
    # NOTE: this is lossy — we can't distinguish original admins from converted drivers
    op.alter_column('trips', 'assigned_to', new_column_name='driver_id')

    op.drop_constraint('fk_trips_assigned_to_users', 'trips', type_='foreignkey')
    op.create_foreign_key(
        'fk_trips_driver_id_users', 'trips', 'users',
        ['driver_id'], ['id'], ondelete='SET NULL'
    )
