from sqlalchemy.orm import Session
from app.models.user import User
from app.schemas.user import UserCreate
from passlib.hash import bcrypt

class UserService:
    @staticmethod
    def create_user(db: Session, user: UserCreate):
        hashed_password = bcrypt.hash(user.password)
        db_user = User(username=user.username, password=hashed_password)
        db.add(db_user)
        db.commit()
        db.refresh(db_user)
        return db_user

    @staticmethod
    def authenticate_user(db: Session, username: str, password: str):
        user = db.query(User).filter(User.username == username).first()
        if user and bcrypt.verify(password, user.password):
            return user
        return None