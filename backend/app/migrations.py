"""Additive-only column migration for columns added after `recipes` already
existed in a deployed database (`create_all()` only creates missing tables,
it never alters existing ones). No column is dropped or overwritten.

Proportionate to this project's current scale (one environment, no Alembic
version history yet) - replace with real Alembic migrations if that changes.
"""

from sqlalchemy import inspect, text

_USERS_COLUMNS_TO_ADD = {
    "avatar_key": "VARCHAR(500) NULL",
}

_RECIPE_COLUMNS_TO_ADD = {
    "owner_sub": "VARCHAR(64) NULL",
    "owner_email": "VARCHAR(255) NULL",
    "created_at": "DATETIME NULL DEFAULT CURRENT_TIMESTAMP",
    "updated_at": "DATETIME NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP",
}


def run_migrations(engine):
    inspector = inspect(engine)

    if "users" in inspector.get_table_names():
        existing = {col["name"] for col in inspector.get_columns("users")}
        with engine.begin() as conn:
            for col, defn in _USERS_COLUMNS_TO_ADD.items():
                if col not in existing:
                    conn.execute(text(f"ALTER TABLE users ADD COLUMN {col} {defn}"))

    if "recipes" not in inspector.get_table_names():
        return

    existing_columns = {col["name"] for col in inspector.get_columns("recipes")}

    with engine.begin() as connection:
        for column_name, column_definition in _RECIPE_COLUMNS_TO_ADD.items():
            if column_name not in existing_columns:
                connection.execute(
                    text(f"ALTER TABLE recipes ADD COLUMN {column_name} {column_definition}")
                )

        existing_indexes = {idx["name"] for idx in inspector.get_indexes("recipes")}
        if "owner_sub" not in existing_columns and "ix_recipes_owner_sub" not in existing_indexes:
            connection.execute(text("CREATE INDEX ix_recipes_owner_sub ON recipes (owner_sub)"))
