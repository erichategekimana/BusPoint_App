import sys
from datetime import datetime, timedelta
from app import create_app
from app.database import db
from app.models import User, Bus, Route, Stop, RouteStop, Trip
from app.auth import hash_password

def seed_data():
    app = create_app()
    with app.app_context():
        print("Cleaning up existing data...")
        # Delete in order to respect foreign key constraints
        db.session.query(Trip).delete()
        db.session.query(RouteStop).delete()
        db.session.query(Stop).delete()
        db.session.query(Route).delete()
        db.session.query(Bus).delete()
        db.session.query(User).delete()
        
        print("Seeding Users...")
        # Create an Admin and a few Passengers
        admin = User(
            full_name="System Admin",
            phone_number="0780000000",
            email="admin@buspoint.rw",
            password_hash=hash_password("admin123"),
            role="admin"
        )
        passenger = User(
            full_name="John Doe",
            phone_number="0781234567",
            email="john@example.com",
            password_hash=hash_password("password123"),
            role="passenger"
        )
        db.session.add_all([admin, passenger])

        print("Seeding Buses...")
        # Create different bus types
        bus1 = Bus(plate_number="RAE 123A", bus_type="Coaster", capacity=30)
        bus2 = Bus(plate_number="RAB 456B", bus_type="Coach", capacity=60)
        db.session.add_all([bus1, bus2])

        print("Seeding Stops...")
        # Common locations in Kigali
        stop_nyabugogo = Stop(name="Nyabugogo", latitude=-1.9398, longitude=30.0441)
        stop_kimironko = Stop(name="Kimironko", latitude=-1.9351, longitude=30.1251)
        stop_remera = Stop(name="Remera", latitude=-1.9585, longitude=30.1130)
        db.session.add_all([stop_nyabugogo, stop_kimironko, stop_remera])
        db.session.flush() # Get IDs for route mapping

        print("Seeding Routes...")
        # Main city routes
        route1 = Route(route_code="R101", name="Nyabugogo - Kimironko")
        db.session.add(route1)
        db.session.flush()

        # Define the sequence of stops for Route 1
        rs1 = RouteStop(route_id=route1.id, stop_id=stop_nyabugogo.id, stop_order=1, estimated_minutes_from_start=0)
        rs2 = RouteStop(route_id=route1.id, stop_id=stop_kimironko.id, stop_order=2, estimated_minutes_from_start=45)
        db.session.add_all([rs1, rs2])

        print("Seeding Trips...")
        # Schedule a trip for today
        departure = datetime.now() + timedelta(hours=2)
        trip1 = Trip(
            bus_id=bus1.id,
            route_id=route1.id,
            departure_time=departure,
            status="scheduled",
            current_capacity=bus1.capacity
        )
        db.session.add(trip1)

        try:
            db.session.commit()
            print("Database successfully seeded!")
        except Exception as e:
            db.session.rollback()
            print(f"Error seeding database: {e}")

if __name__ == "__main__":
    seed_data()