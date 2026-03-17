"""change geom to geometry

Revision ID: 5b04864eeb75
Revises: 
Create Date: 2026-03-13 14:30:03.383184

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '5b04864eeb75'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        ALTER TABLE stops 
        ALTER COLUMN geom TYPE geometry(Point, 4326) 
        USING geom::geometry(Point, 4326)
    """)

def downgrade():
    op.execute("""
        ALTER TABLE stops 
        ALTER COLUMN geom TYPE geography(Point, 4326) 
        USING geom::geography(Point, 4326)
    """)