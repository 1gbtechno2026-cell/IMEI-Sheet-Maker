"""invoice sheet style

Revision ID: 20261106_0007
Revises: 20261106_0006
Create Date: 2026-11-06 12:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20261106_0007"
down_revision: Union[str, None] = "20261106_0006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("invoices") as batch_op:
        batch_op.add_column(sa.Column("sheet_style", sa.String(length=20), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("invoices") as batch_op:
        batch_op.drop_column("sheet_style")
