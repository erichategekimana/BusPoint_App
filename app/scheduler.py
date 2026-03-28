"""
Departure reminder scheduler.

Creates notifications for passengers with confirmed bookings:
  - 1 hour before departure
  - 10 minutes before departure
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from apscheduler.schedulers.background import BackgroundScheduler

from app.database import db
from app.gps_simulator import tick as gps_tick
from app.models import Booking, Notification, Trip

log = logging.getLogger(__name__)

_scheduler: BackgroundScheduler | None = None


def _send_departure_reminders(app):
    """Check for upcoming departures and create reminder notifications."""
    with app.app_context():
        now = datetime.now(timezone.utc)

        reminders = [
            (timedelta(hours=1), timedelta(minutes=5), "1 Hour Until Departure",
             "Your bus on route {route} departs in about 1 hour. Get ready!"),
            (timedelta(minutes=10), timedelta(minutes=5), "10 Minutes Until Departure",
             "Your bus on route {route} departs in 10 minutes! Head to your stop now."),
        ]

        for offset, window, title_tpl, message_tpl in reminders:
            window_start = now + offset - window
            window_end = now + offset + window

            trips = Trip.query.filter(
                Trip.departure_time >= window_start,
                Trip.departure_time <= window_end,
                Trip.status.in_(["scheduled", "in_progress"]),
            ).all()

            for trip in trips:
                bookings = Booking.query.filter(
                    Booking.trip_id == trip.id,
                    Booking.status.in_(["pending", "confirmed"]),
                ).all()

                for booking in bookings:
                    # Avoid duplicate notifications
                    existing = Notification.query.filter(
                        Notification.user_id == booking.user_id,
                        Notification.title == title_tpl,
                        Notification.type == "departure_reminder",
                    ).filter(
                        Notification.message.contains(str(trip.id)[:8])
                    ).first()

                    if existing:
                        continue

                    route_name = trip.route.name if trip.route else "Unknown"
                    notif = Notification(
                        user_id=booking.user_id,
                        title=title_tpl,
                        message=message_tpl.format(route=route_name) + f" (Trip {str(trip.id)[:8]})",
                        type="departure_reminder",
                        is_ready=False,
                    )
                    db.session.add(notif)

                if bookings:
                    db.session.commit()

        log.debug("Departure reminder check completed")


def init_scheduler(app):
    """Start the background scheduler if not already running."""
    global _scheduler
    if _scheduler is not None:
        return

    _scheduler = BackgroundScheduler(daemon=True)
    _scheduler.add_job(
        func=_send_departure_reminders,
        trigger="interval",
        minutes=5,
        args=[app],
        id="departure_reminders",
        replace_existing=True,
    )
    _scheduler.add_job(
        func=gps_tick,
        trigger="interval",
        seconds=10,
        args=[app],
        id="gps_simulation",
        replace_existing=True,
    )
    _scheduler.start()
    log.info("Scheduler started (departure reminders every 5 min, GPS simulation every 10 s)")
