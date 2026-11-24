const express = require('express')
const cors = require('cors')
const { MongoClient, ObjectId } = require('mongodb')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
require('dotenv').config()

const app = express()
app.use(cors())
app.use(express.json())

const PORT = process.env.PORT || 5000
const MONGO_URI = process.env.MONGO_URI
const JWT_SECRET = process.env.JWT_SECRET
const DEFAULT_LOW_STOCK = 5

const client = new MongoClient(MONGO_URI || 'mongodb://127.0.0.1:27017')
let db = null

// ---------- Basic routes ----------
app.get('/', (req, res) => {
  res.json({ success: true, message: 'Welcome to StockFlow Backend!' })
})

app.get('/api/test', (req, res) => {
  res.json({ success: true, message: 'React connected to StockFlow Backend!' })
})

app.get('/api/db-test', (req, res) => {
  res.json({
    success: !!db,
    message: db ? 'MongoDB connected successfully!' : 'MongoDB is not connected'
  })
})

// ---------- Auth middleware ----------
function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization
  const token = authHeader && authHeader.split(' ')[1]

  if (!token) {
    return res.status(401).json({ success: false, message: 'Access denied. Please login first.' })
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ success: false, message: 'Invalid or expired token' })
    }
    if (!ObjectId.isValid(decoded.userId) || !ObjectId.isValid(decoded.organizationId)) {
      return res.status(403).json({ success: false, message: 'Invalid authentication data' })
    }
    req.user = decoded
    next()
  })
}

// ---------- Signup ----------
app.post('/api/signup', async (req, res) => {
  let organizationId = null
  let userId = null

  try {
    if (!db) {
      return res.status(503).json({ success: false, message: 'Database is not connected' })
    }

    const { organization, email, password } = req.body

    if (
      typeof organization !== 'string' ||
      typeof email !== 'string' ||
      typeof password !== 'string' ||
      !organization.trim() ||
      !email.trim() ||
      !password
    ) {
      return res.status(400).json({ success: false, message: 'Please fill all fields' })
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must contain at least 6 characters' })
    }

    const cleanEmail = email.toLowerCase().trim()
    const cleanOrganization = organization.trim()

    const existingUser = await db.collection('users').findOne({ email: cleanEmail })
    if (existingUser) {
      return res.status(409).json({ success: false, message: 'Email already registered' })
    }

    const hashedPassword = await bcrypt.hash(password, 10)
    userId = new ObjectId()

    const organizationResult = await db.collection('organizations').insertOne({
      name: cleanOrganization,
      ownerUserId: userId,
      defaultLowStockThreshold: DEFAULT_LOW_STOCK,
      createdAt: new Date()
    })
    organizationId = organizationResult.insertedId

    await db.collection('users').insertOne({
      _id: userId,
      organization: cleanOrganization,
      organizationId,
      email: cleanEmail,
      password: hashedPassword,
      createdAt: new Date()
    })

    const token = jwt.sign(
      { userId: userId.toString(), organizationId: organizationId.toString() },
      JWT_SECRET,
      { expiresIn: '1d' }
    )

    return res.status(201).json({ success: true, message: 'Registration successful!', token })
  } catch (error) {
    console.error('Signup error:', error.message)

    if (userId && db) {
      await db.collection('users').deleteOne({ _id: userId }).catch(() => {})
    }
    if (organizationId && db) {
      await db.collection('organizations').deleteOne({ _id: organizationId }).catch(() => {})
    }

    return res.status(500).json({ success: false, message: 'Signup failed' })
  }
})

// ---------- Login ----------
app.post('/api/login', async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ success: false, message: 'Database is not connected' })
    }

    const { email, password } = req.body

    if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
      return res.status(400).json({ success: false, message: 'Please enter email and password' })
    }

    const user = await db.collection('users').findOne({ email: email.toLowerCase().trim() })
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' })
    }

    const isMatch = await bcrypt.compare(password, user.password)
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' })
    }

    if (!user.organizationId) {
      return res.status(400).json({ success: false, message: 'Organization setup is incomplete' })
    }

    const token = jwt.sign(
      { userId: user._id.toString(), organizationId: user.organizationId.toString() },
      JWT_SECRET,
      { expiresIn: '1d' }
    )

    return res.json({ success: true, message: 'Login successful!', token })
  } catch (error) {
    console.error('Login error:', error.message)
    return res.status(500).json({ success: false, message: 'Login failed' })
  }
})

app.get('/api/protected', authenticateToken, (req, res) => {
  res.json({
    success: true,
    message: 'Authentication successful!',
    userId: req.user.userId,
    organizationId: req.user.organizationId
  })
})

// ---------- Helpers ----------
const validPrice = (value) =>
  value === undefined ||
  value === null ||
  (typeof value === 'number' && Number.isFinite(value) && value >= 0)

const validThreshold = (value) =>
  value === undefined ||
  value === null ||
  (Number.isSafeInteger(value) && value >= 0)

async function getDefaultThreshold(organizationId) {
  const org = await db.collection('organizations').findOne({
    _id: new ObjectId(organizationId)
  })
  return org?.defaultLowStockThreshold ?? DEFAULT_LOW_STOCK
}

// ---------- Products ----------
app.post('/api/products', authenticateToken, async (req, res) => {
  try {
    const { name, sku, description, quantity, costPrice, sellingPrice, lowStockThreshold } = req.body

    if (typeof name !== 'string' || !name.trim() || typeof sku !== 'string' || !sku.trim()) {
      return res.status(400).json({ success: false, message: 'Product name and SKU are required' })
    }

    const productQuantity = quantity === undefined ? 0 : quantity

    if (!Number.isSafeInteger(productQuantity) || productQuantity < 0) {
      return res.status(400).json({ success: false, message: 'Quantity must be a non-negative integer' })
    }

    if (!validThreshold(lowStockThreshold)) {
      return res.status(400).json({ success: false, message: 'Invalid low stock threshold' })
    }

    if (!validPrice(costPrice) || !validPrice(sellingPrice)) {
      return res.status(400).json({ success: false, message: 'Invalid product price' })
    }

    const product = {
      organizationId: new ObjectId(req.user.organizationId),
      name: name.trim(),
      sku: sku.trim().toUpperCase(),
      description: typeof description === 'string' ? description.trim() : '',
      quantity: productQuantity,
      costPrice: costPrice ?? null,
      sellingPrice: sellingPrice ?? null,
      lowStockThreshold: lowStockThreshold ?? null,
      lastUpdatedBy: new ObjectId(req.user.userId),
      createdAt: new Date(),
      updatedAt: new Date()
    }

    const result = await db.collection('products').insertOne(product)

    return res.status(201).json({
      success: true,
      message: 'Product added successfully!',
      product: { ...product, _id: result.insertedId }
    })
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'This SKU already exists in your organization' })
    }
    console.error('Add product error:', error.message)
    return res.status(500).json({ success: false, message: 'Failed to add product' })
  }
})

app.get('/api/products', authenticateToken, async (req, res) => {
  try {
    const products = await db.collection('products')
      .find({ organizationId: new ObjectId(req.user.organizationId) })
      .sort({ createdAt: -1 })
      .toArray()

    return res.json({ success: true, count: products.length, products })
  } catch (error) {
    console.error('Get products error:', error.message)
    return res.status(500).json({ success: false, message: 'Failed to fetch products' })
  }
})

app.put('/api/products/:id', authenticateToken, async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid product ID' })
    }

    const allowedFields = [
      'name', 'sku', 'description', 'quantity',
      'costPrice', 'sellingPrice', 'lowStockThreshold'
    ]

    const updates = {}
    for (const field of allowedFields) {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) {
        updates[field] = req.body[field]
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, message: 'No valid fields provided' })
    }

    if (updates.name !== undefined) {
      if (typeof updates.name !== 'string' || !updates.name.trim()) {
        return res.status(400).json({ success: false, message: 'Invalid product name' })
      }
      updates.name = updates.name.trim()
    }

    if (updates.sku !== undefined) {
      if (typeof updates.sku !== 'string' || !updates.sku.trim()) {
        return res.status(400).json({ success: false, message: 'Invalid SKU' })
      }
      updates.sku = updates.sku.trim().toUpperCase()
    }

    if (updates.description !== undefined) {
      if (typeof updates.description !== 'string') {
        return res.status(400).json({ success: false, message: 'Description must be text' })
      }
      updates.description = updates.description.trim()
    }

    if (
      updates.quantity !== undefined &&
      (!Number.isSafeInteger(updates.quantity) || updates.quantity < 0)
    ) {
      return res.status(400).json({ success: false, message: 'Invalid quantity' })
    }

    if (updates.lowStockThreshold !== undefined && !validThreshold(updates.lowStockThreshold)) {
      return res.status(400).json({ success: false, message: 'Invalid low stock threshold' })
    }

    if (!validPrice(updates.costPrice) || !validPrice(updates.sellingPrice)) {
      return res.status(400).json({ success: false, message: 'Invalid product price' })
    }

    updates.lastUpdatedBy = new ObjectId(req.user.userId)
    updates.updatedAt = new Date()

    const result = await db.collection('products').findOneAndUpdate(
      {
        _id: new ObjectId(req.params.id),
        organizationId: new ObjectId(req.user.organizationId)
      },
      { $set: updates },
      { returnDocument: 'after' }
    )

    const updatedProduct = result?.value ?? result

    if (!updatedProduct || !updatedProduct._id) {
      return res.status(404).json({ success: false, message: 'Product not found' })
    }

    return res.json({
      success: true,
      message: 'Product updated successfully!',
      product: updatedProduct
    })
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'This SKU already exists in your organization' })
    }
    console.error('Update product error:', error.message)
    return res.status(500).json({ success: false, message: 'Failed to update product' })
  }
})

app.delete('/api/products/:id', authenticateToken, async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid product ID' })
    }

    const result = await db.collection('products').deleteOne({
      _id: new ObjectId(req.params.id),
      organizationId: new ObjectId(req.user.organizationId)
    })

    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, message: 'Product not found' })
    }

    return res.json({ success: true, message: 'Product deleted successfully!' })
  } catch (error) {
    console.error('Delete product error:', error.message)
    return res.status(500).json({ success: false, message: 'Failed to delete product' })
  }
})

// ---------- Settings ----------
app.get('/api/settings', authenticateToken, async (req, res) => {
  try {
    const defaultLowStockThreshold = await getDefaultThreshold(req.user.organizationId)
    return res.json({ success: true, defaultLowStockThreshold })
  } catch (error) {
    console.error('Get settings error:', error.message)
    return res.status(500).json({ success: false, message: 'Failed to load settings' })
  }
})

app.put('/api/settings', authenticateToken, async (req, res) => {
  try {
    const { defaultLowStockThreshold } = req.body

    if (!Number.isSafeInteger(defaultLowStockThreshold) || defaultLowStockThreshold < 0) {
      return res.status(400).json({ success: false, message: 'Threshold must be a non-negative whole number' })
    }

    await db.collection('organizations').updateOne(
      { _id: new ObjectId(req.user.organizationId) },
      { $set: { defaultLowStockThreshold } }
    )

    return res.json({ success: true, message: 'Settings saved!', defaultLowStockThreshold })
  } catch (error) {
    console.error('Update settings error:', error.message)
    return res.status(500).json({ success: false, message: 'Failed to save settings' })
  }
})

// ---------- Dashboard ----------
app.get('/api/dashboard', authenticateToken, async (req, res) => {
  try {
    const defaultThreshold = await getDefaultThreshold(req.user.organizationId)

    const products = await db.collection('products')
      .find({ organizationId: new ObjectId(req.user.organizationId) })
      .toArray()

    const totalQuantity = products.reduce((sum, p) => sum + p.quantity, 0)

    const lowStock = products
      .map((p) => ({ ...p, effectiveThreshold: p.lowStockThreshold ?? defaultThreshold }))
      .filter((p) => p.quantity <= p.effectiveThreshold)

    return res.json({
      success: true,
      totalProducts: products.length,
      totalQuantity,
      defaultLowStockThreshold: defaultThreshold,
      lowStock
    })
  } catch (error) {
    console.error('Dashboard error:', error.message)
    return res.status(500).json({ success: false, message: 'Failed to load dashboard' })
  }
})

// ---------- Migration for old users ----------
async function migrateExistingUsers() {
  const users = await db.collection('users')
    .find({ organizationId: { $exists: false } })
    .toArray()

  for (const user of users) {
    const organizationResult = await db.collection('organizations').insertOne({
      name: user.organization || 'My Organization',
      ownerUserId: user._id,
      defaultLowStockThreshold: DEFAULT_LOW_STOCK,
      createdAt: new Date()
    })

    await db.collection('users').updateOne(
      { _id: user._id },
      { $set: { organizationId: organizationResult.insertedId } }
    )
  }
}

// ---------- 404 and errors (must stay last) ----------
app.use('/api', (req, res) => {
  res.status(404).json({
    success: false,
    message: `API route not found: ${req.method} ${req.originalUrl}`
  })
})

app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400) {
    return res.status(400).json({ success: false, message: 'Invalid JSON request body' })
  }
  console.error('Server error:', err.message)
  return res.status(500).json({ success: false, message: 'Internal server error' })
})

// ---------- Start ----------
async function startServer() {
  try {
    if (!MONGO_URI) throw new Error('MONGO_URI is missing in .env')
    if (!JWT_SECRET) throw new Error('JWT_SECRET is missing in .env')

    await client.connect()
    db = client.db('stockflow')
    await db.command({ ping: 1 })
    console.log('MongoDB connected successfully!')

    await db.collection('products').createIndex(
      { organizationId: 1, sku: 1 },
      { unique: true }
    )

    await migrateExistingUsers()

    app.listen(PORT, () => {
      console.log(`StockFlow server running on port ${PORT}`)
    })
  } catch (error) {
    console.error('Server startup failed:', error.message)
    process.exit(1)
  }
}

startServer()