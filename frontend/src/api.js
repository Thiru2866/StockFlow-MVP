export async function readJsonResponse(response) {
  const contentType = response.headers.get('content-type') || ''

  if (!contentType.toLowerCase().includes('application/json')) {
    const body = await response.text()
    const responseType = body.trim().startsWith('<') ? 'HTML' : 'non-JSON data'
    throw new Error(
      `Backend returned ${responseType} (HTTP ${response.status}). Check the API route and Vite proxy.`
    )
  }

  return response.json()
}

export async function api(path, options = {}) {
  const token = localStorage.getItem('token')

  const response = await fetch('/api' + path, {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  })

  if (response.status === 401 || response.status === 403) {
    localStorage.removeItem('token')
    window.location.href = '/'
    throw new Error('Session expired. Please login again.')
  }

  const data = await readJsonResponse(response)

  if (!response.ok) {
    throw new Error(data.message || 'Request failed')
  }

  return data
}
