import express, { type Request, type Response, type Application } from "express"
import { Pool, type QueryResult } from "pg"

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
})

app.get("/posts", async (req: Request, res: Response) => {
  try {
    // We expect the result to conform to the 'Post' interface.
    const result: QueryResult<Post> = await pool.query(
      "SELECT id, title FROM posts ORDER BY created_at DESC"
    )
    res.status(200).json(result.rows) // Send the rows back. `result.rows` is now known to be an array of Post-like objects.
  } catch (error) {
    // Error handling remains the same.
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
      const { title, body } = req.body // `req.body` is now type-checked.

      // Basic validation.
      if (!title) {
        return res.status(400).json({ error: "Title is required" })
      }

      // SQL query with placeholders for security.
      const queryText =
        "INSERT INTO posts(title, body) VALUES($1, $2) RETURNING *"
      const queryValues = [title, body]

      // Execute the query.
      const result: QueryResult<Post> = await pool.query(queryText, queryValues)

      // Send the newly created post back to the client.
      res.status(201).json(result.rows[0])
    } catch (error) {
      console.error("Error executing query", error)
      res.status(500).json({ error: "Internal Server Error" })
    }
  }
)

// Make the application listen on the specified port.
app.listen(PORT, () => {
  // Log a message to the console once the server is running.
  console.log(`Server is running on http://localhost:${PORT} with Bun!`)
})
