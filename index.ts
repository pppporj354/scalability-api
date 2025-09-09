import express, { type Request, type Response, type Application } from "express"
import { Pool, type QueryResult } from "pg"
import { createClient } from "redis"

interface Post {
  id: number
  title: string
  body?: string
  created_at: string
}

const app: Application = express()
const PORT: number = 3000

app.use(express.json())

const pool = new Pool({
  user: "postgres",
  host: "localhost",
  database: "scalability",
  password: "354",
  port: 5432,
  max: 50, // Increased max connections for better concurrency handling.
})

const redisClient = createClient({
  url: "redis://localhost:6379",
})

redisClient.on("error", (err) => console.error("Redis Client Error", err))

const POSTS_CACHE_KEY = "posts:all"

app.get("/posts", async (req: Request, res: Response) => {
  try {
    // Check if the posts are in the Redis cache.
    const cachedPosts = await redisClient.get(POSTS_CACHE_KEY)

    if (cachedPosts) {
      console.log("Serving from cache")
      return res.status(200).json(JSON.parse(cachedPosts))
    }

    console.log("Cache Miss!")

    const result: QueryResult<Post> = await pool.query(
      "SELECT id, title FROM posts ORDER BY created_at DESC"
    )
    const posts = result.rows

    // Store the fetched posts in the Redis cache.
    await redisClient.set(POSTS_CACHE_KEY, JSON.stringify(posts), { EX: 30 })

    res.status(200).json(posts)
  } catch (error) {
    console.error("Error executing query", error)
    res.status(500).json({ error: "Internal Server Error" })
  }
})

app.post(
  "/posts",
  async (
    req: Request<{}, {}, { title: string; body?: string }>,
    res: Response
  ) => {
    try {
      const { title, body } = req.body

      if (!title) {
        return res.status(400).json({ error: "Title is required" })
      }

      const queryText =
        "INSERT INTO posts(title, body) VALUES($1, $2) RETURNING *"
      const queryValues = [title, body]

      const result: QueryResult<Post> = await pool.query(queryText, queryValues)

      // Invalidate the cache since the data has changed.
      console.log("Invalidating cache...")
      await redisClient.del(POSTS_CACHE_KEY)

      res.status(201).json(result.rows[0])
    } catch (error) {
      console.error("Error executing query", error)
      res.status(500).json({ error: "Internal Server Error" })
    }
  }
)

const startServer = async () => {
  try {
    await redisClient.connect()
    console.log("Connected to Redis")

    app.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`)
    })
  } catch (error) {
    console.error("Failed to start server", error)
    process.exit(1)
  }
}

startServer()
