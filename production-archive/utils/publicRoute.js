const publicRoutes = [
  { path: "/api/v1/auth/forget-password", methods: ["POST"] },
  { path: "/api/v1/auth/reset-password/:token", methods: ["PATCH"] },
];

exports.isPublicRoute = (path, method) => {
  return publicRoutes.some((route) => {
    // Simple wildcard for :token
    const routePath = route.path.replace(/:\w+/g, "[^/]+");
    const regex = new RegExp(`^${routePath}$`);
    return regex.test(path) && route.methods.includes(method);
  });
};
