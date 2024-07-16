import { Hono } from "hono";
import { Prisma, PrismaClient } from "@prisma/client/edge";
import { withAccelerate } from "@prisma/extension-accelerate";
import { sign, verify } from "hono/jwt";

const app = new Hono<{
  Bindings: {
    DATABASE_URL: string;
    jwt_token: string;
  };
  Variables: {
    id: string;
  };
}>();

//auth_middleware
app.use("/api/v1/blog/*", async (c, next) => {
  const headers = c.req.header("authorization") || "";
  try {
    const verify_jwt = await verify(headers, c.env.jwt_token);
    if (!verify_jwt.id)
      return c.json({ err: true, status: "404", msg: "unauthorized" });
    //@ts-ignore
    c.set("id", verify_jwt.id);
    await next();
  } catch (err) {
    return c.json({ err: true, status: "404", msg: "unauthorized" });
  }
});

//singup route
app.post("/api/v1/singup", async (c) => {
  const prisma = new PrismaClient({
    datasourceUrl: c.env?.DATABASE_URL,
  }).$extends(withAccelerate());

  try {
    const body = await c.req.json();
    const user = await prisma.user.create({
      data: {
        email: body.email,
        password: body.password,
        name: body.name,
      },
    });
    if (!user) return c.json({ err: true, msg: "invalid email" });
    const token = await sign({ id: user.id }, c.env.jwt_token);

    return c.json({ err: false, msg: "account has created", token: token });
  } catch {
    return c.json({ err: true, msg: "some thing went wrong" });
  }
});

//singin
app.post("/api/v1/singin", async (c) => {
  const prisma = new PrismaClient({
    datasourceUrl: c.env?.DATABASE_URL,
  }).$extends(withAccelerate());

  try {
    const body = await c.req.json();
    const user = await prisma.user.findUnique({
      where: {
        email: body.email,
        password: body.password,
      },
    });
    if (!user) return c.json({ err: true, msg: "user not found" });
    const token = await sign({ id: user.id }, c.env.jwt_token);

    return c.json({ err: false, msg: "singin done", token: token });
  } catch {
    return c.status(404);
  }
});

//blog
app.post("/api/v1/blog", async (c) => {
  const prisma = new PrismaClient({
    datasourceUrl: c.env?.DATABASE_URL,
  }).$extends(withAccelerate());

  const body = await c.req.json();
  const _id = c.get("id");
  const user = await prisma.user.findUnique({
    where: {
      id: _id,
    },
  });

  if (!user) return c.json({ err: true, msg: "some thing went worng" });
  const post = await prisma.post.create({
    data: {
      title: body.title,
      content: body.content,
      published: body.published,
      authorID: _id,
    },
  });

  if (!post) return c.json({ err: true, msg: "err" });

  return c.json({
    err: false,
    msg: "post have been created",
    published: post.published,
    postId: post.id,
  });
});

app.put("/api/v1/blog/:id", async (c) => {
  const prisma = new PrismaClient({
    datasourceUrl: c.env?.DATABASE_URL,
  }).$extends(withAccelerate());

  let body;
  let id;

  try {
    body = await c.req.json();
    id = c.req.param("id");
  } catch (err) {
    return c.json({ err: true, msg: "Invalid JSON input" });
  }

  try {
    const blog = await prisma.post.findFirst({
      where: {
        id: id,
      },
    });

    if (!blog) return c.json({ err: true, msg: "Cannot find blog" });

    const updatedBlog = await prisma.post.update({
      //@ts-ignore
      where: { id: id },
      data: {
        title: body.title,
        content: body.content,
        published: body.published,
      },
    });

    return c.json({ err: false, msg: "updated succesfully" });
  } catch (err) {
    //@ts-ignore
    return c.json({ err: true, msg: `Something went wrong: ${err.message}` });
  }
});

app.get("/api/v1/blog", async (c) => {
  const prisma = new PrismaClient({
    datasourceUrl: c.env?.DATABASE_URL,
  }).$extends(withAccelerate());

  try {
    const blog = await prisma.post.findMany();
    if (!blog) return c.json({ err: true, msg: "no blogs" });
    return c.json({ posts: blog });
  } catch {
    return c.json({ err: true, msg: "some thing went wrong" });
  }
});

export default app;
function next() {
  throw new Error("Function not implemented.");
}
