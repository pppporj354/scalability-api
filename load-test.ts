import http from "k6/http"

import { sleep, check } from "k6"
import { Trend } from "k6/metrics"

import type { Options } from "k6/options"

const postsGetTrend = new Trend("get_posts_duration") // This will track the response time for the GET request.
const postsPostTrend = new Trend("post_posts_duration") // This will track the response time for the POST request.

export const options: Options = {
  scenarios: {
    // The first scenario is for our "Reader" persona.

    readers: {
      executor: "ramping-vus",
      exec: "readAPI",
      startVUs: 0,
      stages: [
        // This is the load profile for the readers.
        { duration: "30s", target: 80 }, // Stage 1: Ramp up from 0 to 80 VUs over 30 seconds.
        { duration: "1m", target: 80 }, // Stage 2: Sustain 80 VUs for 1 minute (this is the main load period).
        { duration: "20s", target: 0 }, // Stage 3: Ramp down from 80 to 0 VUs over 20 seconds.
      ],
    },
    // The second scenario is for our "Creator" persona.
    creators: {
      executor: "ramping-vus",
      exec: "writeAPI",
      startVUs: 0,
      stages: [
        { duration: "30s", target: 20 }, // Ramp up to 20 VUs over 30s.
        { duration: "1m", target: 20 }, // Sustain 20 VUs for 1 minute.
        { duration: "20s", target: 0 }, // Ramp down to 0 VUs.
      ],
    },
  },

  thresholds: {
    http_req_failed: ["rate<0.01"], // The failure rate for all HTTP requests should be less than 1%.
    http_req_duration: ["p(95)<500"], // 95% of all requests must complete in under 500 milliseconds.
    "get_posts_duration{scenario:readers}": ["p(95)<400"], // For the readers scenario, the GET /posts endpoint should be extra fast (under 400ms).
    "post_posts_duration{scenario:creators}": ["p(95)<800"], // For the creators scenario, POST requests can be a bit slower (under 800ms) as they involve database writes.
  },
}

const API_BASE_URL = "http://localhost:3000"

// This function simulates the "Reader" user journey.
export function readAPI() {
  // Make a GET request to the /posts endpoint.
  const response = http.get(`${API_BASE_URL}/posts`) // The backticks `` create a template literal for easy string construction.

  // Add the response time of this specific request to our custom Trend metric.
  postsGetTrend.add(response.timings.duration)

  // Check if the request was successful.
  check(response, {
    // The check is named descriptively. 'r' is the response object.
    "GET /posts returned status 200": (r) => r.status === 200, // This logic checks if the HTTP status code was 200 (OK).
  })

  // Simulate think time. The user "reads" the posts for 1 to 3 seconds.
  sleep(Math.random() * 2 + 1) // Pauses for a random duration between 1 and 3 seconds to make the simulation more realistic.
}

export function writeAPI() {
  const getResponse = http.get(`${API_BASE_URL}/posts`)

  // Add the response time to the GET trend metric.
  postsGetTrend.add(getResponse.timings.duration)

  // Check if the GET request was successful.
  check(getResponse, {
    "[Creator] GET /posts returned status 200": (r) => r.status === 200,
  })

  // Simulate the user taking some time to decide what to write.
  sleep(Math.random() * 2 + 2) // Pause for 2 to 4 seconds.

  const payload = JSON.stringify({
    title: `k6 performance test post by VU=${__VU}, iter=${__ITER}`,
    body: "This post was created during a k6 load test to check API scalability.",
  })

  // Define the headers for the POST request.
  const params = {
    headers: {
      "Content-Type": "application/json", // This header tells the server we are sending JSON data.
    },
  }

  const postResponse = http.post(`${API_BASE_URL}/posts`, payload, params)

  // Add the response time of the POST request to its specific Trend metric.
  postsPostTrend.add(postResponse.timings.duration)

  // Check if the post was created successfully.
  check(postResponse, {
    // The check name is descriptive.
    "[Creator] POST /posts returned status 201": (r) => r.status === 201, // A successful resource creation should return HTTP 201 Created.
  })

  // Simulate a final pause after creating the post.
  sleep(Math.random() * 2 + 3) // Pause for 3 to 5 seconds.
}
