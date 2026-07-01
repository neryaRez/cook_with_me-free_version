from sqlalchemy import Column, DateTime, Float, Integer, String, Text
from sqlalchemy.sql import func
from sqlalchemy.types import JSON

from .db import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    cognito_sub = Column(String(64), unique=True, nullable=False, index=True)
    email = Column(String(255), nullable=False)
    display_name = Column(String(255), nullable=True)
    username = Column(String(100), nullable=True)
    bio = Column(Text, nullable=True)
    avatar_url = Column(Text, nullable=True)
    avatar_key = Column(String(500), nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)


class Recipe(Base):
    __tablename__ = "recipes"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    image = Column(Text, nullable=False, default="")
    image_key = Column(String(500), nullable=True)
    category = Column(String(100), nullable=False, default="Quick Meals")
    cuisine = Column(String(100), nullable=False, default="Fusion")
    difficulty = Column(String(50), nullable=False, default="Easy")
    prep_time = Column(Integer, nullable=False, default=0)
    cook_time = Column(Integer, nullable=False, default=0)
    servings = Column(Integer, nullable=False, default=1)
    rating = Column(Float, nullable=False, default=0)

    author_name = Column(String(255), nullable=False, default="Guest Chef")
    author_avatar = Column(Text, nullable=False, default="https://i.pravatar.cc/100?img=1")

    tags = Column(JSON, nullable=False, default=list)
    ingredients = Column(JSON, nullable=False, default=list)
    steps = Column(JSON, nullable=False, default=list)
    comments = Column(JSON, nullable=False, default=list)

    owner_sub = Column(String(64), nullable=True, index=True)
    owner_email = Column(String(255), nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)
