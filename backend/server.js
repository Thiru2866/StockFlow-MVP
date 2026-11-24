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

app.put('/api/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body

    if (typeof currentPassword !== 'string' || typeof newPassword !== 'string') {
      return res.status(400).json({ success: false, message: 'Current and new passwords are required' })
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'New password must contain at least 6 characters' })
    }
    if (currentPassword === newPassword) {
      return res.status(400).json({ success: false, message: 'New password must be different from the current password' })
    }

    const user = await db.collection('users').findOne({
      _id: new ObjectId(req.user.userId),
      organizationId: new ObjectId(req.user.organizationId)
    })
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' })
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password)
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect' })
    }

    await db.collection('users').updateOne(
      { _id: user._id },
      { $set: { password: await bcrypt.hash(newPassword, 10), updatedAt: new Date() } }
    )

    return res.json({ success: true, message: 'Password changed successfully!' })
  } catch (error) {
    console.error('Change password error:', error.message)
    return res.status(500).json({ success: false, message: 'Failed to change password' })
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
    const { name, sku, barcode, description, category, brand, quantity, costPrice, sellingPrice, lowStockThreshold } = req.body

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

    if (category !== undefined && category !== null && typeof category !== 'string') {
      return res.status(400).json({ success: false, message: 'Category must be text' })
    }

    if (brand !== undefined && brand !== null && typeof brand !== 'string') {
      return res.status(400).json({ success: false, message: 'Brand must be text' })
    }

    if (barcode !== undefined && barcode !== null && typeof barcode !== 'string') {
      return res.status(400).json({ success: false, message: 'Barcode must be text' })
    }

    const product = {
      organizationId: new ObjectId(req.user.organizationId),
      name: name.trim(),
      sku: sku.trim().toUpperCase(),
      barcode: typeof barcode === 'string' ? barcode.trim() : '',
      description: typeof description === 'string' ? description.trim() : '',
      category: typeof category === 'string' ? category.trim() : '',
      brand: typeof brand === 'string' ? brand.trim() : '',
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

app.get('/api/products/export', authenticateToken, async (req, res) => {
  try {
    const organizationId = new ObjectId(req.user.organizationId)
    const products = await db.collection('products')
      .find({ organizationId })
      .sort({ createdAt: -1 })
      .toArray()

    const escapeCsv = (value) => {
      const text = value === undefined || value === null ? '' : String(value)
      return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
    }

    const headers = [
      'Name', 'SKU', 'Barcode', 'Description', 'Category', 'Brand',
      'Quantity', 'Cost Price', 'Selling Price', 'Low Stock Threshold'
    ]
    const rows = products.map((product) => [
      product.name,
      product.sku,
      product.barcode,
      product.description,
      product.category,
      product.brand,
      product.quantity,
      product.costPrice,
      product.sellingPrice,
      product.lowStockThreshold
    ])
    const csv = [headers, ...rows]
      .map((row) => row.map(escapeCsv).join(','))
      .join('\r\n')

    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', 'attachment; filename="stockflow-products.csv"')
    return res.send('\uFEFF' + csv)
  } catch (error) {
    console.error('Export products error:', error.message)
    return res.status(500).json({ success: false, message: 'Failed to export products' })
  }
})

app.post('/api/products/import', authenticateToken, async (req, res) => {
  try {
    const rows = req.body?.products
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ success: false, message: 'No products supplied for import' })
    }
    if (rows.length > 1000) {
      return res.status(400).json({ success: false, message: 'A maximum of 1000 products can be imported at once' })
    }

    const organizationId = new ObjectId(req.user.organizationId)
    const userId = new ObjectId(req.user.userId)
    let imported = 0
    let updated = 0
    const errors = []

    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index]
      const name = typeof row.name === 'string' ? row.name.trim() : ''
      const sku = typeof row.sku === 'string' ? row.sku.trim().toUpperCase() : ''
      const quantity = row.quantity === '' || row.quantity === undefined || row.quantity === null
        ? 0
        : Number(row.quantity)

      if (!name || !sku) {
        errors.push(`Row ${index + 2}: Product name and SKU are required`)
        continue
      }
      if (!Number.isSafeInteger(quantity) || quantity < 0) {
        errors.push(`Row ${index + 2}: Quantity must be a non-negative integer`)
        continue
      }

      const costPrice = row.costPrice === '' || row.costPrice == null ? null : Number(row.costPrice)
      const sellingPrice = row.sellingPrice === '' || row.sellingPrice == null ? null : Number(row.sellingPrice)
      const lowStockThreshold = row.lowStockThreshold === '' || row.lowStockThreshold == null
        ? null
        : Number(row.lowStockThreshold)

      if (!validPrice(costPrice) || !validPrice(sellingPrice) || !validThreshold(lowStockThreshold)) {
        errors.push(`Row ${index + 2}: One or more numeric values are invalid`)
        continue
      }

      const product = {
        organizationId,
        name,
        sku,
        barcode: typeof row.barcode === 'string' ? row.barcode.trim() : '',
        description: typeof row.description === 'string' ? row.description.trim() : '',
        category: typeof row.category === 'string' ? row.category.trim() : '',
        brand: typeof row.brand === 'string' ? row.brand.trim() : '',
        quantity,
        costPrice,
        sellingPrice,
        lowStockThreshold,
        lastUpdatedBy: userId,
        updatedAt: new Date()
      }

      const existing = await db.collection('products').findOne({ organizationId, sku })
      if (existing) {
        await db.collection('products').updateOne(
          { _id: existing._id, organizationId },
          { $set: product }
        )
        updated += 1
      } else {
        await db.collection('products').insertOne({
          ...product,
          createdAt: new Date()
        })
        imported += 1
      }
    }

    return res.json({
      success: true,
      message: `Imported ${imported} and updated ${updated} products`,
      imported,
      updated,
      errors
    })
  } catch (error) {
    console.error('Import products error:', error.message)
    return res.status(500).json({ success: false, message: 'Failed to import products' })
  }
})

app.put('/api/products/:id', authenticateToken, async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid product ID' })
    }

    const allowedFields = [
      'name', 'sku', 'barcode', 'description', 'category', 'brand', 'quantity',
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

    if (updates.category !== undefined) {
      if (typeof updates.category !== 'string') {
        return res.status(400).json({ success: false, message: 'Category must be text' })
      }
      updates.category = updates.category.trim()
    }

    if (updates.brand !== undefined) {
      if (typeof updates.brand !== 'string') {
        return res.status(400).json({ success: false, message: 'Brand must be text' })
      }
      updates.brand = updates.brand.trim()
    }

    if (updates.barcode !== undefined) {
      if (typeof updates.barcode !== 'string') {
        return res.status(400).json({ success: false, message: 'Barcode must be text' })
      }
      updates.barcode = updates.barcode.trim()
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

app.post('/api/products/:id/movement', authenticateToken, async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid product ID' })
    }

    const { type, quantity, note } = req.body
    const allowedTypes = ['stock-in', 'sale', 'damage', 'return', 'stock-out', 'adjustment']
    if (!allowedTypes.includes(type)) {
      return res.status(400).json({ success: false, message: 'Invalid stock movement type' })
    }
    if (!Number.isSafeInteger(quantity) || quantity === 0) {
      return res.status(400).json({ success: false, message: 'Movement quantity must be a non-zero integer' })
    }
    if (note !== undefined && typeof note !== 'string') {
      return res.status(400).json({ success: false, message: 'Movement note must be text' })
    }

    const organizationId = new ObjectId(req.user.organizationId)
    const product = await db.collection('products').findOne({
      _id: new ObjectId(req.params.id),
      organizationId
    })
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' })
    }

    const isOutbound = ['sale', 'damage', 'stock-out'].includes(type)
    const change = isOutbound ? -Math.abs(quantity) : (type === 'adjustment' ? quantity : Math.abs(quantity))
    const newQuantity = product.quantity + change
    if (newQuantity < 0) {
      return res.status(400).json({ success: false, message: 'Insufficient stock for this movement' })
    }

    await db.collection('products').updateOne(
      { _id: product._id, organizationId },
      { $set: { quantity: newQuantity, lastUpdatedBy: new ObjectId(req.user.userId), updatedAt: new Date() } }
    )

    const movement = {
      organizationId,
      productId: product._id,
      productName: product.name,
      sku: product.sku,
      type,
      quantity: change,
      previousQuantity: product.quantity,
      newQuantity,
      note: typeof note === 'string' ? note.trim() : '',
      createdBy: new ObjectId(req.user.userId),
      createdAt: new Date()
    }
    await db.collection('stock_movements').insertOne(movement)

    return res.json({
      success: true,
      message: 'Stock movement recorded!',
      quantity: newQuantity,
      movement
    })
  } catch (error) {
    console.error('Stock movement error:', error.message)
    return res.status(500).json({ success: false, message: 'Failed to record stock movement' })
  }
})

app.get('/api/products/movements', authenticateToken, async (req, res) => {
  try {
    const movements = await db.collection('stock_movements')
      .find({ organizationId: new ObjectId(req.user.organizationId) })
      .sort({ createdAt: -1 })
      .limit(100)
      .toArray()

    return res.json({ success: true, movements })
  } catch (error) {
    console.error('Get stock movements error:', error.message)
    return res.status(500).json({ success: false, message: 'Failed to load stock movements' })
  }
})

// ---------- Suppliers ----------
app.get('/api/suppliers', authenticateToken, async (req, res) => {
  try {
    const suppliers = await db.collection('suppliers')
      .find({ organizationId: new ObjectId(req.user.organizationId) })
      .sort({ name: 1 })
      .toArray()
    return res.json({ success: true, suppliers })
  } catch (error) {
    console.error('Get suppliers error:', error.message)
    return res.status(500).json({ success: false, message: 'Failed to load suppliers' })
  }
})

app.post('/api/suppliers', authenticateToken, async (req, res) => {
  try {
    const { name, contactName, email, phone, address, notes } = req.body
    if (typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Supplier name is required' })
    }
    if (email !== undefined && email !== '' && typeof email === 'string' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, message: 'Invalid supplier email' })
    }

    const supplier = {
      organizationId: new ObjectId(req.user.organizationId),
      name: name.trim(),
      contactName: typeof contactName === 'string' ? contactName.trim() : '',
      email: typeof email === 'string' ? email.trim().toLowerCase() : '',
      phone: typeof phone === 'string' ? phone.trim() : '',
      address: typeof address === 'string' ? address.trim() : '',
      notes: typeof notes === 'string' ? notes.trim() : '',
      createdAt: new Date(),
      updatedAt: new Date()
    }
    const result = await db.collection('suppliers').insertOne(supplier)
    return res.status(201).json({ success: true, supplier: { ...supplier, _id: result.insertedId } })
  } catch (error) {
    console.error('Create supplier error:', error.message)
    return res.status(500).json({ success: false, message: 'Failed to add supplier' })
  }
})

app.put('/api/suppliers/:id', authenticateToken, async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid supplier ID' })
    }
    const allowed = ['name', 'contactName', 'email', 'phone', 'address', 'notes']
    const updates = {}
    for (const field of allowed) {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) {
        updates[field] = req.body[field]
      }
    }
    if (updates.name !== undefined && (typeof updates.name !== 'string' || !updates.name.trim())) {
      return res.status(400).json({ success: false, message: 'Supplier name is required' })
    }
    if (updates.name !== undefined) updates.name = updates.name.trim()
    if (updates.email !== undefined) {
      updates.email = typeof updates.email === 'string' ? updates.email.trim().toLowerCase() : ''
      if (updates.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(updates.email)) {
        return res.status(400).json({ success: false, message: 'Invalid supplier email' })
      }
    }
    for (const field of ['contactName', 'phone', 'address', 'notes']) {
      if (updates[field] !== undefined) updates[field] = typeof updates[field] === 'string' ? updates[field].trim() : ''
    }
    updates.updatedAt = new Date()

    const result = await db.collection('suppliers').findOneAndUpdate(
      { _id: new ObjectId(req.params.id), organizationId: new ObjectId(req.user.organizationId) },
      { $set: updates },
      { returnDocument: 'after' }
    )
    const supplier = result?.value ?? result
    if (!supplier || !supplier._id) {
      return res.status(404).json({ success: false, message: 'Supplier not found' })
    }
    return res.json({ success: true, supplier })
  } catch (error) {
    console.error('Update supplier error:', error.message)
    return res.status(500).json({ success: false, message: 'Failed to update supplier' })
  }
})

app.delete('/api/suppliers/:id', authenticateToken, async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid supplier ID' })
    }
    const result = await db.collection('suppliers').deleteOne({
      _id: new ObjectId(req.params.id),
      organizationId: new ObjectId(req.user.organizationId)
    })
    if (!result.deletedCount) {
      return res.status(404).json({ success: false, message: 'Supplier not found' })
    }
    return res.json({ success: true, message: 'Supplier deleted' })
  } catch (error) {
    console.error('Delete supplier error:', error.message)
    return res.status(500).json({ success: false, message: 'Failed to delete supplier' })
  }
})

// ---------- Reports ----------
app.get('/api/reports', authenticateToken, async (req, res) => {
  try {
    const organizationId = new ObjectId(req.user.organizationId)
    const defaultThreshold = await getDefaultThreshold(req.user.organizationId)
    const products = await db.collection('products').find({ organizationId }).toArray()
    const movements = await db.collection('stock_movements')
      .find({ organizationId })
      .sort({ createdAt: -1 })
      .limit(100)
      .toArray()

    const inventoryValue = products.reduce((sum, product) =>
      sum + (product.quantity * (product.costPrice ?? 0)), 0)
    const retailValue = products.reduce((sum, product) =>
      sum + (product.quantity * (product.sellingPrice ?? 0)), 0)
    const lowStock = products.filter((product) =>
      product.quantity <= (product.lowStockThreshold ?? defaultThreshold))
    const movementIn = movements.filter((movement) => movement.quantity > 0)
      .reduce((sum, movement) => sum + movement.quantity, 0)
    const movementOut = movements.filter((movement) => movement.quantity < 0)
      .reduce((sum, movement) => sum + Math.abs(movement.quantity), 0)

    return res.json({
      success: true,
      summary: {
        totalProducts: products.length,
        totalUnits: products.reduce((sum, product) => sum + product.quantity, 0),
        lowStockCount: lowStock.length,
        inventoryValue,
        retailValue,
        stockInUnits: movementIn,
        stockOutUnits: movementOut
      },
      lowStock,
      movements
    })
  } catch (error) {
    console.error('Reports error:', error.message)
    return res.status(500).json({ success: false, message: 'Failed to load reports' })
  }
})

// ---------- Orders ----------
app.get('/api/orders', authenticateToken, async (req, res) => {
  try {
    const orders = await db.collection('orders')
      .find({ organizationId: new ObjectId(req.user.organizationId) })
      .sort({ createdAt: -1 })
      .limit(200)
      .toArray()
    return res.json({ success: true, orders })
  } catch (error) {
    console.error('Get orders error:', error.message)
    return res.status(500).json({ success: false, message: 'Failed to load orders' })
  }
})

app.post('/api/orders', authenticateToken, async (req, res) => {
  try {
    const { type, partyName, partyId, items, notes } = req.body
    if (!['purchase', 'sale'].includes(type)) {
      return res.status(400).json({ success: false, message: 'Order type must be purchase or sale' })
    }
    if (typeof partyName !== 'string' || !partyName.trim()) {
      return res.status(400).json({ success: false, message: 'Customer or supplier name is required' })
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Add at least one order item' })
    }

    const organizationId = new ObjectId(req.user.organizationId)
    const userId = new ObjectId(req.user.userId)
    const normalizedItems = []
    let total = 0

    for (const item of items) {
      if (!ObjectId.isValid(item.productId)) {
        return res.status(400).json({ success: false, message: 'Invalid product in order' })
      }
      const quantity = Number(item.quantity)
      if (!Number.isSafeInteger(quantity) || quantity <= 0) {
        return res.status(400).json({ success: false, message: 'Order quantities must be positive whole numbers' })
      }
      const price = Number(item.price)
      if (!Number.isFinite(price) || price < 0) {
        return res.status(400).json({ success: false, message: 'Invalid item price' })
      }

      const product = await db.collection('products').findOne({
        _id: new ObjectId(item.productId),
        organizationId
      })
      if (!product) {
        return res.status(404).json({ success: false, message: 'One of the selected products was not found' })
      }
      if (type === 'sale' && product.quantity < quantity) {
        return res.status(400).json({ success: false, message: `Insufficient stock for ${product.name}` })
      }

      normalizedItems.push({
        productId: product._id,
        name: product.name,
        sku: product.sku,
        quantity,
        price
      })
      total += quantity * price
    }

    for (const item of normalizedItems) {
      const product = await db.collection('products').findOne({
        _id: item.productId,
        organizationId
      })
      const change = type === 'purchase' ? item.quantity : -item.quantity
      const newQuantity = product.quantity + change
      await db.collection('products').updateOne(
        { _id: item.productId, organizationId },
        { $set: { quantity: newQuantity, lastUpdatedBy: userId, updatedAt: new Date() } }
      )
      await db.collection('stock_movements').insertOne({
        organizationId,
        productId: item.productId,
        productName: item.name,
        sku: item.sku,
        type: type === 'purchase' ? 'stock-in' : 'sale',
        quantity: change,
        previousQuantity: product.quantity,
        newQuantity,
        note: `${type === 'purchase' ? 'Purchase' : 'Sale'} order`,
        createdBy: userId,
        createdAt: new Date()
      })
    }

    const order = {
      organizationId,
      type,
      partyName: partyName.trim(),
      partyId: partyId && ObjectId.isValid(partyId) ? new ObjectId(partyId) : null,
      items: normalizedItems,
      total,
      status: 'completed',
      notes: typeof notes === 'string' ? notes.trim() : '',
      createdBy: userId,
      createdAt: new Date(),
      updatedAt: new Date()
    }
    const result = await db.collection('orders').insertOne(order)
    return res.status(201).json({
      success: true,
      message: `${type === 'purchase' ? 'Purchase' : 'Sale'} order completed`,
      order: { ...order, _id: result.insertedId }
    })
  } catch (error) {
    console.error('Create order error:', error.message)
    return res.status(500).json({ success: false, message: 'Failed to create order' })
  }
})

app.delete('/api/orders/:id', authenticateToken, async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid order ID' })
    }
    const organizationId = new ObjectId(req.user.organizationId)
    const order = await db.collection('orders').findOne({
      _id: new ObjectId(req.params.id),
      organizationId
    })
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' })
    }

    for (const item of order.items) {
      const product = await db.collection('products').findOne({
        _id: item.productId,
        organizationId
      })
      if (!product) continue
      const reversal = order.type === 'purchase' ? -item.quantity : item.quantity
      const newQuantity = product.quantity + reversal
      if (newQuantity < 0) {
        return res.status(400).json({ success: false, message: 'Cannot reverse order because stock would become negative' })
      }
    }
    for (const item of order.items) {
      const product = await db.collection('products').findOne({
        _id: item.productId,
        organizationId
      })
      if (!product) continue
      const reversal = order.type === 'purchase' ? -item.quantity : item.quantity
      const newQuantity = product.quantity + reversal
      await db.collection('products').updateOne(
        { _id: item.productId, organizationId },
        { $set: { quantity: newQuantity, updatedAt: new Date() } }
      )
      await db.collection('stock_movements').insertOne({
        organizationId,
        productId: item.productId,
        productName: item.name,
        sku: item.sku,
        type: 'adjustment',
        quantity: reversal,
        previousQuantity: product.quantity,
        newQuantity,
        note: `Reversal of ${order.type} order`,
        createdBy: new ObjectId(req.user.userId),
        createdAt: new Date()
      })
    }
    await db.collection('orders').deleteOne({ _id: order._id, organizationId })
    return res.json({ success: true, message: 'Order reversed and deleted' })
  } catch (error) {
    console.error('Delete order error:', error.message)
    return res.status(500).json({ success: false, message: 'Failed to reverse order' })
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