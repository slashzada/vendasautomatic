const Database = require('better-sqlite3');
const db = new Database('loja_final.db');

function setupDatabase() {
    db.exec(`CREATE TABLE IF NOT EXISTS products (id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT)`);
    db.exec(`CREATE TABLE IF NOT EXISTS variations (id INTEGER PRIMARY KEY AUTOINCREMENT, product_id TEXT NOT NULL, name TEXT NOT NULL, price REAL NOT NULL, stock INTEGER NOT NULL DEFAULT 0, digital_content TEXT NOT NULL, FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE)`);
    db.exec(`CREATE TABLE IF NOT EXISTS coupons (code TEXT PRIMARY KEY, discount_type TEXT NOT NULL, discount_value REAL NOT NULL, uses_left INTEGER DEFAULT 1)`);
    db.exec(`CREATE TABLE IF NOT EXISTS transactions (payment_id TEXT PRIMARY KEY, user_id TEXT NOT NULL, variation_id INTEGER NOT NULL, final_price REAL NOT NULL, status TEXT NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
    console.log('Banco de dados final configurado com sucesso.');
}

setupDatabase();

module.exports = {
    // Funções de Produto
    addProduct: (id, name, description) => db.prepare('INSERT INTO products (id, name, description) VALUES (?, ?, ?)').run(id, name, description),
    getProduct: (id) => db.prepare('SELECT * FROM products WHERE id = ?').get(id),
    getAllProducts: () => db.prepare('SELECT p.* FROM products p JOIN variations v ON p.id = v.product_id WHERE v.stock > 0 GROUP BY p.id').all(),
    getAllBaseProducts: () => db.prepare('SELECT * FROM products').all(),
    deleteProduct: (id) => db.prepare('DELETE FROM products WHERE id = ?').run(id),

    // Funções de Variação
    addVariation: (product_id, name, price, stock, digital_content) => db.prepare('INSERT INTO variations (product_id, name, price, stock, digital_content) VALUES (?, ?, ?, ?, ?)').run(product_id, name, price, stock, digital_content),
    getVariationsForProduct: (product_id) => db.prepare('SELECT * FROM variations WHERE product_id = ? AND stock > 0').all(product_id),
    getVariation: (id) => db.prepare('SELECT * FROM variations WHERE id = ?').get(id),
    decreaseStock: (id) => db.prepare('UPDATE variations SET stock = stock - 1 WHERE id = ?').run(id),
    deleteVariation: (id) => db.prepare('DELETE FROM variations WHERE id = ?').run(id),
    addStock: (id, quantity) => db.prepare('UPDATE variations SET stock = stock + ? WHERE id = ?').run(quantity, id),

    // Funções de Cupom
    addCoupon: (code, type, value, uses) => db.prepare('INSERT INTO coupons (code, discount_type, discount_value, uses_left) VALUES (?, ?, ?, ?)').run(code, type, value, uses),
    getCoupon: (code) => db.prepare('SELECT * FROM coupons WHERE code = ? AND uses_left > 0').get(code),
    useCoupon: (code) => db.prepare('UPDATE coupons SET uses_left = uses_left - 1 WHERE code = ?').run(code),
    getAllCoupons: () => db.prepare('SELECT * FROM coupons').all(),

    // Funções de Transação
    addTransaction: (paymentId, userId, variationId, finalPrice) => db.prepare("INSERT INTO transactions (payment_id, user_id, variation_id, final_price, status) VALUES (?, ?, ?, ?, 'PENDING')").run(paymentId, userId, variationId, finalPrice),
    updateTransactionStatus: (paymentId, status) => db.prepare('UPDATE transactions SET status = ? WHERE payment_id = ?').run(status, paymentId),
    getRecentTransactions: (limit = 10) => db.prepare('SELECT * FROM transactions ORDER BY created_at DESC LIMIT ?').all(limit),
    getTransactionByPaymentId: (paymentId) => db.prepare('SELECT * FROM transactions WHERE payment_id = ?').get(paymentId),

    // Função de Variação com Info do Produto
    getAllVariationsWithProductInfo: () => db.prepare(`SELECT v.id, v.name as variation_name, v.price, v.stock, p.name as product_name FROM variations v JOIN products p ON v.product_id = p.id`).all(),
};