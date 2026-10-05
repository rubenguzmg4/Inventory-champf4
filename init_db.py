from database import engine, Base
import models  # Carga la definición de todos los modelos

def inicializar_bd():
    print("Creando tablas en la base de datos PostgreSQL...")
    Base.metadata.create_all(bind=engine)
    print("¡Todas las tablas fueron creadas exitosamente!")

if __name__ == "__main__":
    inicializar_bd()