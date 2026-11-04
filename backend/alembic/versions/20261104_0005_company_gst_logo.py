"""company GST rows, logo, typed-sheet GST choice, item country

Revision ID: 20261104_0005
Revises: 20260311_0004
Create Date: 2026-11-04 13:50:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20261104_0005"
down_revision: Union[str, None] = "20260311_0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "company_gsts",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("company_id", sa.Integer(), sa.ForeignKey("companies.id"), nullable=False),
        sa.Column("label", sa.String(length=100), nullable=False),
        sa.Column("state", sa.String(length=100), nullable=False),
        sa.Column("gstin", sa.String(length=20), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
    )
    with op.batch_alter_table("companies") as batch_op:
        batch_op.add_column(sa.Column("logo_path", sa.String(length=512), nullable=True))
    with op.batch_alter_table("invoices") as batch_op:
        batch_op.add_column(sa.Column("seller_gst_id", sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column("buyer_gst_id", sa.Integer(), nullable=True))
    with op.batch_alter_table("invoice_items") as batch_op:
        batch_op.add_column(sa.Column("country_of_origin", sa.String(length=100), nullable=True))

    conn = op.get_bind()
    companies = conn.execute(sa.text("SELECT id, gstin, state FROM companies")).fetchall()
    for company_id, gstin, state in companies:
        gstin_text = (gstin or "").strip()
        state_text = (state or "").strip()
        if not gstin_text and not state_text:
            continue
        conn.execute(
            sa.text(
                "INSERT INTO company_gsts (company_id, label, state, gstin, sort_order) "
                "VALUES (:company_id, :label, :state, :gstin, 0)"
            ),
            {
                "company_id": company_id,
                "label": state_text or "GST",
                "state": state_text or "—",
                "gstin": gstin_text or "—",
            },
        )


def downgrade() -> None:
    with op.batch_alter_table("invoice_items") as batch_op:
        batch_op.drop_column("country_of_origin")
    with op.batch_alter_table("invoices") as batch_op:
        batch_op.drop_column("buyer_gst_id")
        batch_op.drop_column("seller_gst_id")
    with op.batch_alter_table("companies") as batch_op:
        batch_op.drop_column("logo_path")
    op.drop_table("company_gsts")
