import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import authRouter from "./auth.routes.js";
import superadminRouter from "./superadmin.routes.js";
import resellerRouter from "./reseller.routes.js";
import serversRouter from "./servers.routes.js";
import deviceRouter from "./device.routes.js";
import contentRouter from "./content.routes.js";
import streamRouter from "./stream.routes.js";
import meRouter from "./me.routes.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(superadminRouter);
router.use(resellerRouter);
router.use(serversRouter);

// Device (Flutter app) routes
router.use(deviceRouter);
router.use(contentRouter);
router.use(streamRouter);
router.use(meRouter);

export default router;
