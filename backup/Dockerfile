# Servicio de respaldos: PostgreSQL (pg_dump / pg_restore) + zonas horarias para respaldar a la hora local.
FROM postgres:17-alpine
RUN apk add --no-cache tzdata
COPY backup.sh /backup.sh
# Por si Git en Windows convirtió el archivo a saltos de línea de Windows (CRLF), que romperían el script
RUN sed -i 's/\r$//' /backup.sh && chmod +x /backup.sh
ENTRYPOINT ["/backup.sh"]
CMD ["daemon"]
