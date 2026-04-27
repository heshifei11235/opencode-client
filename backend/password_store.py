import os
import hashlib
import base64
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.backends import default_backend
from typing import Optional


SALT_LENGTH = 32
ITERATIONS = 100_000
KEY_LENGTH = 32  # AES-256


def generate_salt() -> bytes:
    return os.urandom(SALT_LENGTH)


def derive_key(password: str, salt: bytes) -> bytes:
    kdf = PBKDF2HMAC(
        algorithm=hashlib.sha256(),
        length=KEY_LENGTH,
        salt=salt,
        iterations=ITERATIONS,
        backend=default_backend()
    )
    return kdf.derive(password.encode())


def hash_password(password: str, salt: bytes) -> str:
    key = derive_key(password, salt)
    return base64.b64encode(key).decode()


def verify_password(password: str, salt: bytes, stored_hash: str) -> bool:
    computed_hash = hash_password(password, salt)
    return computed_hash == stored_hash


def encrypt_password(password: str, key: bytes) -> bytes:
    aesgcm = AESGCM(key)
    nonce = os.urandom(12)  # 96-bit nonce for GCM
    ciphertext = aesgcm.encrypt(nonce, password.encode(), None)
    return nonce + ciphertext


def decrypt_password(encrypted_data: bytes, key: bytes) -> str:
    aesgcm = AESGCM(key)
    nonce = encrypted_data[:12]
    ciphertext = encrypted_data[12:]
    plaintext = aesgcm.decrypt(nonce, ciphertext, None)
    return plaintext.decode()


class PasswordStore:
    def __init__(self):
        self._key: Optional[bytes] = None

    def unlock(self, master_password: str, salt: bytes, stored_hash: str) -> bool:
        if not verify_password(master_password, salt, stored_hash):
            return False
        self._key = derive_key(master_password, salt)
        return True

    def lock(self):
        self._key = None

    def is_unlocked(self) -> bool:
        return self._key is not None

    def encrypt(self, plaintext: str) -> bytes:
        if not self._key:
            raise ValueError("Password store is locked")
        return encrypt_password(plaintext, self._key)

    def decrypt(self, ciphertext: bytes) -> str:
        if not self._key:
            raise ValueError("Password store is locked")
        return decrypt_password(ciphertext, self._key)


# Global instance
password_store = PasswordStore()
