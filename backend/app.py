from flask import Flask, request, jsonify, session
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
from functools import wraps
import os
from datetime import datetime, date

app = Flask(__name__)
basedir = os.path.abspath(os.path.dirname(__file__))
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///' + os.path.join(basedir, 'truffle_app.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SECRET_KEY'] = 'your_very_secret_key_for_prod_change_this' # Change this in a real app!
db = SQLAlchemy(app)

# --- Database Models (Copied and refined) ---
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(100), unique=True, nullable=False)
    password_hash = db.Column(db.String(200), nullable=False)
    address = db.Column(db.String(200), nullable=True)
    orders = db.relationship('Order', backref='customer', lazy=True)

    def as_dict(self):
        return {c.name: getattr(self, c.name) for c in self.__table__.columns if c.name != 'password_hash'}

class Product(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.String(200))
    price = db.Column(db.Float, nullable=False)
    image_url = db.Column(db.String(200))
    order_items = db.relationship('OrderItem', backref='product', lazy=True)

    def as_dict(self):
        return {c.name: getattr(self, c.name) for c in self.__table__.columns}

class Order(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    created_at = db.Column(db.DateTime, server_default=db.func.now())
    delivery_date = db.Column(db.String(20), nullable=False) # "YYYY-MM-DD"
    delivery_slot_description = db.Column(db.String(50), nullable=False) # e.g., "Saturday 10:00-14:00"
    total_amount = db.Column(db.Float, nullable=False)
    status = db.Column(db.String(50), default='Pending')
    items = db.relationship('OrderItem', backref='order', lazy=True, cascade="all, delete-orphan")
    delivery_notes = db.Column(db.String(300), nullable=True)

    def as_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'customer_name': self.customer.name if self.customer else 'N/A',
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'delivery_date': self.delivery_date,
            'delivery_slot_description': self.delivery_slot_description,
            'total_amount': self.total_amount,
            'status': self.status,
            'delivery_notes': self.delivery_notes,
            'items': [item.as_dict() for item in self.items]
        }

class OrderItem(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    order_id = db.Column(db.Integer, db.ForeignKey('order.id'), nullable=False)
    product_id = db.Column(db.Integer, db.ForeignKey('product.id'), nullable=False)
    quantity = db.Column(db.Integer, nullable=False)
    price = db.Column(db.Float, nullable=False)

    def as_dict(self):
        return {
            'id': self.id,
            'order_id': self.order_id,
            'product_id': self.product_id,
            'product_name': self.product.name if self.product else "Unknown Product",
            'quantity': self.quantity,
            'price': self.price
        }

class DeliverySlot(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    day_of_week = db.Column(db.String(10), nullable=False) # "Saturday", "Sunday"
    time_slot = db.Column(db.String(20), nullable=False) # "10:00-14:00", "14:00-18:00", "18:00-21:00"

    def as_dict(self):
        return {
            'id': self.id,
            'day_of_week': self.day_of_week,
            'time_slot': self.time_slot,
            'description': f"{self.day_of_week} {self.time_slot}"
        }
# --- End of Database Models ---

# --- Decorators ---
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({'message': 'Authentication required'}), 401
        return f(*args, **kwargs)
    return decorated_function
# --- End of Decorators ---

# --- Auth Endpoints ---
@app.route('/api/register', methods=['POST'])
def register():
    data = request.get_json()
    if not data or not data.get('email') or not data.get('password') or not data.get('name'):
        return jsonify({'message': 'Missing name, email, or password'}), 400
    if User.query.filter_by(email=data['email']).first():
        return jsonify({'message': 'Email already registered'}), 409
    hashed_password = generate_password_hash(data['password'])
    new_user = User(name=data['name'], email=data['email'], password_hash=hashed_password, address=data.get('address', ''))
    db.session.add(new_user)
    db.session.commit()
    return jsonify({'message': 'User registered successfully', 'user': new_user.as_dict()}), 201

@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    if not data or not data.get('email') or not data.get('password'):
        return jsonify({'message': 'Missing email or password'}), 400
    user = User.query.filter_by(email=data['email']).first()
    if not user or not check_password_hash(user.password_hash, data['password']):
        return jsonify({'message': 'Invalid credentials'}), 401
    session['user_id'] = user.id
    session['user_name'] = user.name
    return jsonify({'message': 'Login successful', 'user': user.as_dict()}), 200

@app.route('/api/logout', methods=['POST'])
@login_required
def logout():
    session.pop('user_id', None)
    session.pop('user_name', None)
    return jsonify({'message': 'Logout successful'}), 200

@app.route('/api/check_session', methods=['GET'])
def check_session():
    if 'user_id' in session:
        user = User.query.get(session['user_id'])
        if user:
            return jsonify({'logged_in': True, 'user': user.as_dict()}), 200
        else:
            session.pop('user_id', None)
            session.pop('user_name', None)
            return jsonify({'logged_in': False, 'message': 'User not found, session cleared'}), 404
    return jsonify({'logged_in': False}), 200

@app.route('/api/user/address', methods=['PUT'])
@login_required
def update_address():
    user = User.query.get(session['user_id'])
    if not user: # Should ideally not be hit due to @login_required
        return jsonify({'message': 'User not found'}), 404
    data = request.get_json()
    if not data or 'address' not in data:
        return jsonify({'message': 'Missing address field'}), 400
    user.address = data['address']
    db.session.commit()
    return jsonify({'message': 'Address updated successfully', 'user': user.as_dict()}), 200

# --- End of Auth Endpoints ---

# --- Product Catalog Endpoints ---
@app.route('/api/products', methods=['GET'])
def get_products():
    products = Product.query.all()
    return jsonify([product.as_dict() for product in products]), 200

@app.route('/api/products/<int:product_id>', methods=['GET'])
def get_product(product_id):
    product = Product.query.get(product_id)
    if product:
        return jsonify(product.as_dict()), 200
    return jsonify({'message': 'Product not found'}), 404
# --- End of Product Catalog Endpoints ---

# --- Order Management Endpoints ---
@app.route('/api/delivery-slots', methods=['GET'])
def get_delivery_slots():
    slots = DeliverySlot.query.all()
    return jsonify([slot.as_dict() for slot in slots]), 200

@app.route('/api/orders', methods=['POST'])
@login_required
def place_order():
    data = request.get_json()
    user_id = session['user_id']

    required_fields = ['cart_items', 'delivery_date', 'delivery_slot_id']
    if not all(field in data for field in required_fields):
        return jsonify({'message': 'Missing required fields (cart_items, delivery_date, delivery_slot_id)'}), 400

    cart_items = data['cart_items']
    delivery_date_str = data['delivery_date']
    delivery_slot_id = data['delivery_slot_id']
    delivery_notes = data.get('delivery_notes', '')

    if not cart_items:
        return jsonify({'message': 'Cart cannot be empty'}), 400

    try:
        delivery_dt = datetime.strptime(delivery_date_str, '%Y-%m-%d').date()
        if delivery_dt.weekday() not in [5, 6]: # 5 for Saturday, 6 for Sunday
            return jsonify({'message': 'Delivery is only available on Saturdays and Sundays.'}), 400
        if delivery_dt < date.today():
             return jsonify({'message': 'Delivery date cannot be in the past.'}), 400
    except ValueError:
        return jsonify({'message': 'Invalid delivery date format. Use YYYY-MM-DD.'}), 400

    selected_slot = DeliverySlot.query.get(delivery_slot_id)
    if not selected_slot:
        return jsonify({'message': 'Invalid delivery slot ID.'}), 400

    day_name = delivery_dt.strftime('%A')
    if selected_slot.day_of_week != day_name:
        return jsonify({'message': f'Selected slot is for {selected_slot.day_of_week}, but date is a {day_name}.'}),400

    total_amount = 0
    order_items_to_create = []

    for item_data in cart_items:
        product = Product.query.get(item_data.get('product_id'))
        quantity = item_data.get('quantity')
        if not product or not quantity or int(quantity) <= 0:
            return jsonify({'message': f"Invalid product or quantity for product ID {item_data.get('product_id')}"}), 400

        total_amount += product.price * int(quantity)
        order_items_to_create.append(OrderItem(
            product_id=product.id,
            quantity=int(quantity),
            price=product.price
        ))

    if not order_items_to_create:
        return jsonify({'message': 'No valid items in order'}), 400

    new_order = Order(
        user_id=user_id,
        delivery_date=delivery_date_str,
        delivery_slot_description=f"{selected_slot.day_of_week} {selected_slot.time_slot}",
        total_amount=round(total_amount, 2),
        delivery_notes=delivery_notes,
        status="Pending"
    )

    for oi in order_items_to_create:
        new_order.items.append(oi)

    db.session.add(new_order)
    db.session.commit()

    return jsonify({'message': 'Order placed successfully', 'order': new_order.as_dict()}), 201

@app.route('/api/orders/history', methods=['GET'])
@login_required
def get_order_history():
    user_id = session['user_id']
    orders = Order.query.filter_by(user_id=user_id).order_by(Order.created_at.desc()).all()
    return jsonify([order.as_dict() for order in orders]), 200

# --- End of Order Management Endpoints ---

@app.route('/')
def hello():
    return "Backend is running!"

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
        if not Product.query.first():
            products_data = [
                {'name': 'Salsa al Tartufo Nero', 'description': 'Sapore ricco e terroso', 'price': 15.99, 'image_url': 'https://lh3.googleusercontent.com/aida-public/AB6AXuBC7rKZxN1yVnUay6b8FFG2Tz9kIHi-9vxYWiBf0-EJupqUfVQeeyByMr84AgrwtwejnRbfdLXuyzEJ-ft4yZXRgzg1n1AvODoOGRLZWrkryhmLFLjJEAqgAuw7WONA4x1dciAqkQuzIHKg6o9W29phmIQv3ztJzU0MsaO-_WXOVcS2NKUvbFQBAZqwXthpGdMR1pQctcPrV2LNVcZTJoulBbSA5bildJrLPnrfUl7IQTF9RonnqEyfBTk5VHvQ8Dag4BJ3l52Oa5g'},
                {'name': 'Olio al Tartufo Bianco', 'description': 'Aroma delicato', 'price': 12.50, 'image_url': 'https://lh3.googleusercontent.com/aida-public/AB6AXuDBAHdP_oQep7brsPllplJDbm7XusPJ9J9SyFJgJlJxYzCaHMhiVKADf6KNLRQiibOhWZhwUlEwlsMiUiZFg1Xdp-rLeua69nTTcvXkpE5r-_r1rvSlCo4tSJY9s-1emGhdDfP-K9WbNZ8B5us52Ht__7RSnt7iKyAXQQN-JNMYs7sj_XVAF9rMCI-R1qhMYVWT2BCDfwmdfhkt3lY9Q8R8Ovewv2BE4d023Ig29dIBiLCVDO4myc7ZoQjd_LCqZzVsqwdhunELfH8'},
                {'name': 'Sale al Tartufo', 'description': 'Migliora qualsiasi piatto', 'price': 8.75, 'image_url': 'https://lh3.googleusercontent.com/aida-public/AB6AXuBRywy0D1ZjbrbqKRRVF-HdLkEPNX4HN62bddnGAiplRpukCZcOqEQVe6K37H5MREUHKHXbGzwa-_LDQVF7n0Fd5GDzbbGcn2j2gGjM3FMzlbaXUdEbIvETP8zSLC34pKFQwr4Mtn2T26euhzIEIB_sVy0xrBNcoebkCg1MW34BUGx7OrVpB0Wz61JcTE6k6VLYKuVLhv0wMD1azyLf-QHvz2B7jpLYt1dQ9GNzHemKLIrWoiZGkUTvxibxpBPFdk72-evUXUHHDAM'},
                {'name': 'Miele al Tartufo', 'description': 'Dolce e salato', 'price': 10.20, 'image_url': 'https://lh3.googleusercontent.com/aida-public/AB6AXuBS_kg6eLrXFm7AffVRCEbcn9QOKMWx-ikZUBfcGLScWs0r4rwhJTb0fabrXvkEU6ZbANmfBMIuWWu0U9gDHtSZw9tcM1PfAQwDYDbRj5Qpxm3WiAHL2gow5kXPEEPltBntAFhQlGuYsNizhdxhne_HpnJdcqFAvKt-z_ZZZBMv-kgu9rpKk-S7-IF5Wo5x6BDV_hLcL5cjfc5cCfqmCndneBLfBeIbdqZOitqY-1ymvkwrsDauovCRWhrK37duOXWEJuQJu1wOBeo'},
            ]
            for p_data in products_data:
                db.session.add(Product(**p_data))
            db.session.commit()
        if not DeliverySlot.query.first():
            slots = [
                ("Saturday", "10:00-14:00"),
                ("Saturday", "14:00-18:00"),
                ("Saturday", "18:00-21:00"),
                ("Sunday", "10:00-14:00"),
                ("Sunday", "14:00-18:00"),
                ("Sunday", "18:00-21:00"),
            ]
            for day, time in slots:
                db.session.add(DeliverySlot(day_of_week=day, time_slot=time))
            db.session.commit()
        print("Database schema ensured and initial data checked/populated.")
    # app.run(debug=True) # Not running here
