"""invoice item colour

Revision ID: 20261106_0006
Revises: 20261104_0005
Create Date: 2026-11-06 10:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20261106_0006"
down_revision: Union[str, None] = "20261104_0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("invoice_items") as batch_op:
        batch_op.add_column(sa.Column("color", sa.String(length=50), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("invoice_items") as batch_op:
        batch_op.drop_column("color")
