import Fastify from "fastify";
import { env } from "./config/env";

const server = Fastify({
  logger: {
    level: env.NODE_ENV === "production" ? "info" : "debug",
  },
});

// TODO: Registrar plugins (cors, rate-limit, jwt, redis, socket)
// TODO: Registrar rutas de modulos

const start = async () => {
  try {
    await server.listen({ port: 3001, host: "0.0.0.0" });
    server.log.info("Habla! API corriendo en puerto 3001");
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
