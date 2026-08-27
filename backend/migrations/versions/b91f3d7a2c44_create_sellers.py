"""create sellers

Revision ID: b91f3d7a2c44
Revises: a013802bc98d
Create Date: 2026-08-25

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "b91f3d7a2c44"
down_revision = "a013802bc98d"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "sellers",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("seller_number", sa.Integer(), nullable=False),
        sa.Column("email", sa.String(length=100), nullable=False),
        sa.Column(
            "active",
            sa.Boolean(),
            server_default=sa.true(),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
        sa.UniqueConstraint("seller_number"),
    )


def downgrade():
    op.drop_table("sellers")
