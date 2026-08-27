"""link sales to sellers

Revision ID: c62a8e4f109d
Revises: b91f3d7a2c44
Create Date: 2026-08-25

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "c62a8e4f109d"
down_revision = "b91f3d7a2c44"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("sales", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column("seller_id", sa.Integer(), nullable=True)
        )
        batch_op.create_index(
            batch_op.f("ix_sales_seller_id"),
            ["seller_id"],
            unique=False,
        )
        batch_op.create_foreign_key(
            "fk_sales_seller_id_sellers",
            "sellers",
            ["seller_id"],
            ["id"],
            ondelete="SET NULL",
        )


def downgrade():
    with op.batch_alter_table("sales", schema=None) as batch_op:
        batch_op.drop_constraint(
            "fk_sales_seller_id_sellers",
            type_="foreignkey",
        )
        batch_op.drop_index(batch_op.f("ix_sales_seller_id"))
        batch_op.drop_column("seller_id")
