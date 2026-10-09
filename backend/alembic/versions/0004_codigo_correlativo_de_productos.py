"""codigo correlativo de productos

Crea el contador de códigos (product_code_seq), asigna un código a los productos que no lo tengan
y hace obligatorio el campo.

Revision ID: 0004
Revises: 0003
Create Date: 2026-10-08

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0004'
down_revision: Union[str, Sequence[str], None] = '0003'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # OWNED BY: el contador se elimina junto con la tabla y se reinicia en las pruebas (TRUNCATE ... RESTART IDENTITY)
    op.execute("CREATE SEQUENCE product_code_seq START 1 OWNED BY products.product_id")

    # Los productos sin código reciben el siguiente correlativo libre, en el orden en que se crearon
    bind = op.get_bind()
    taken = set(bind.execute(sa.text("SELECT code FROM products WHERE code IS NOT NULL")).scalars())
    for product_id in bind.execute(sa.text("SELECT product_id FROM products WHERE code IS NULL ORDER BY product_id")).scalars().all():
        while True:
            code = f"{bind.execute(sa.text('SELECT nextval(:seq)'), {'seq': 'product_code_seq'}).scalar_one():06d}"
            if code not in taken:
                break
        taken.add(code)
        bind.execute(sa.text("UPDATE products SET code = :code WHERE product_id = :id"), {"code": code, "id": product_id})

    op.alter_column('products', 'code', existing_type=sa.String(length=50), nullable=False)


def downgrade() -> None:
    op.alter_column('products', 'code', existing_type=sa.String(length=50), nullable=True)
    op.execute("DROP SEQUENCE product_code_seq")
