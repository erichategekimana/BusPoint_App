"""add gps_pings table for live coordinate logging

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-03-26 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'c3d4e5f6a7b8'
down_revision = 'b2c3d4e5f6a7'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'gps_pings',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('trip_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('latitude', sa.Numeric(precision=10, scale=8), nullable=False),
        sa.Column('longitude', sa.Numeric(precision=11, scale=8), nullable=False),
        sa.Column('timestamp', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('speed_kmh', sa.Numeric(precision=6, scale=2), nullable=True),
        sa.Column('heading', sa.Numeric(precision=5, scale=2), nullable=True),
        sa.Column('accuracy_m', sa.Numeric(precision=7, scale=2), nullable=True),
        sa.Column('nearest_stop_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.ForeignKeyConstraint(['trip_id'], ['trips.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['nearest_stop_id'], ['stops.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_gps_pings_trip_timestamp', 'gps_pings', ['trip_id', 'timestamp'])
    op.create_index('ix_gps_pings_lat_lng', 'gps_pings', ['latitude', 'longitude'])


def downgrade():
    op.drop_index('ix_gps_pings_lat_lng', table_name='gps_pings')
    op.drop_index('ix_gps_pings_trip_timestamp', table_name='gps_pings')
    op.drop_table('gps_pings')
