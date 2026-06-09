import { type RouteConfig, index, route, layout } from "@react-router/dev/routes";

export default [
    route("login", "routes/login.tsx"),
    layout("routes/protected-layout.tsx", [
        index("routes/home.tsx"),
        route("users", "routes/users+/_layout.tsx", [
            route(":id", "routes/users+/$id.detailes.tsx"),
        ]),
    ]),
] satisfies RouteConfig;
