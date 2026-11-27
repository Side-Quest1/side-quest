"""Browser regression with a loopback-only API fixture. Run against the documented QA dev server."""
import base64
import json
import os
import time
from datetime import datetime, timedelta
from urllib.parse import urlparse, parse_qs
from playwright.sync_api import sync_playwright, expect

ORIGIN = "http://127.0.0.1:3408"
USER = "00000000-0000-4000-8000-000000000001"
HOST = "00000000-0000-4000-8000-000000000002"
claims = {"sub": USER, "role": "authenticated", "exp": int(time.time()) + 3600}
def encoded(value):
    return base64.urlsafe_b64encode(json.dumps(value).encode()).decode().rstrip("=")
token = encoded({"alg": "HS256"}) + "." + encoded(claims) + ".c2ln"
user = {"id": USER, "email": "fixture@example.test", "aud": "authenticated", "role":"authenticated",
        "app_metadata": {}, "user_metadata": {}, "identities": []}
records = [dict(id=f"00000000-0000-4000-8001-{i:012d}", title=f"Park walk {i}", area="Central",
    description="A walking group.", reason="Upcoming with space to join.", category="adventure",
    activity_type="outdoor", visibility="public", host_id=HOST, state="open", cost_inr=0,
    latitude=12.98, longitude=77.59, starts_at="2037-01-03T18:00:00Z", ends_at="2037-01-03T20:00:00Z",
    capacity=5, available_spots=4, participations=[], join_mode="approval") for i in range(1,15)]
requests = []
pending = False
def intercept(route):
    global pending
    parsed = urlparse(route.request.url)
    api_request = parsed.path.startswith(("/auth/v1/","/rest/v1/","/functions/v1/"))
    if parsed.netloc == "127.0.0.1:3408" and not api_request:
        return route.continue_()
    if not api_request:
        return route.abort()
    path = parsed.path
    output = []
    if route.request.method == "OPTIONS":
        output = None
    elif path == "/auth/v1/token":
        output = {"access_token": token, "refresh_token": "fixture", "token_type":"bearer","expires_in":3600,"user":user}
    elif path == "/auth/v1/user":
        output = user
    elif path.endswith("/recommend_activities"):
        body = route.request.post_data_json
        requests.append(body)
        offset = 12 if body["after_cursor"] else 0
        output = {"items":records[offset:offset+12],"next":None if offset else {"snapshot":"fixture","offset":12}}
    elif path.endswith("/change_participation"):
        pending = route.request.post_data_json["action"] == "join"
        output = None
    elif path.endswith("/activities"):
        one = {**records[0], "participations": [{"user_id": USER, "status":"pending"}] if pending else []}
        output = one if "id" in parse_qs(parsed.query) else [one]
    elif path.endswith("/participations"):
        output = [{"activity_id":records[0]["id"]}] if pending else []
    elif path.endswith("/discovery_preferences") or path.endswith("/account_profiles"):
        output = None
    elif path.endswith("/my_age_status"):
        output = 18
    route.fulfill(status=200, content_type="application/json",body=json.dumps(output),headers={
        "Access-Control-Allow-Origin":ORIGIN,"Access-Control-Allow-Headers":"*","Access-Control-Allow-Methods":"GET,POST,HEAD,OPTIONS,PATCH,DELETE"})

with sync_playwright() as p:
    browser = p.chromium.launch(channel=os.getenv("SIDEQUEST_BROWSER_CHANNEL","msedge"),headless=True)
    page = browser.new_page(timezone_id="Asia/Kolkata",color_scheme="light",reduced_motion="reduce")
    failures = []
    page.route_web_socket("**/realtime/v1/**",lambda socket: None)
    page.on("pageerror",lambda e: failures.append(str(e)))
    page.route("**/*",intercept)
    page.goto(ORIGIN,wait_until="domcontentloaded",timeout=120000)
    expect(page.get_by_role("button",name="Sign in",exact=True)).to_be_visible(timeout=120000)
    def widths():
        print("Layout:",page.locator("h1,h2").first.inner_text(),flush=True)
        for width in (320,375,390,430,768,1024,1440):
            page.set_viewport_size({"width":width,"height":830})
            page.wait_for_timeout(120)
            assert page.evaluate("document.documentElement.scrollWidth <= innerWidth"), (width,page.evaluate("Array.from(document.querySelectorAll('body *')).filter(e=>e.getBoundingClientRect().right>innerWidth+1).slice(0,12).map(e=>[e.tagName,e.className,Math.round(e.getBoundingClientRect().right)])"))
    print("Checking sign-in widths",flush=True)
    widths()
    page.get_by_label("Email",exact=True).fill("fixture@example.test")
    page.get_by_label("Password",exact=True).fill("local-fixture")
    page.get_by_role("button",name="Sign in",exact=True).click()
    expect(page.get_by_text("Park walk 1",exact=True)).to_be_visible()
    widths()
    page.get_by_label("Search activities or areas").fill("walk")
    page.get_by_role("button",name="adventure",exact=True).click()
    page.get_by_role("button",name="More filters").click()
    page.get_by_label("Maximum budget (INR)").fill("50")
    page.get_by_role("button",name="Load more activities").click()
    expect(page.get_by_text("Park walk 14",exact=True)).to_be_visible()
    page.get_by_role("button",name="Refresh activities").click()
    page.wait_for_timeout(650)
    expect(page.get_by_text("Park walk 14",exact=True)).to_be_visible()
    assert requests[-1]["options"]["budget"]=="50" and requests[-1]["options"]["category"]=="adventure" and requests[-1]["options"]["search"]=="walk"
    page.reload()
    expect(page.get_by_text("Park walk 14",exact=True)).to_be_visible(timeout=15000)
    expect(page.get_by_label("Search activities or areas")).to_have_value("walk")
    assert requests[-1]["options"]["category"]=="adventure" and requests[-1]["options"]["budget"]=="50"
    page.get_by_role("button",name="Map",exact=True).click()
    expect(page.get_by_title("Approximate area for Park walk 1")).to_be_attached()
    page.get_by_role("button",name="View activity",exact=True).first.click()
    page.get_by_role("button",name="Request to join",exact=True).click()
    expect(page.get_by_role("button",name="Cancel request",exact=True)).to_be_visible()
    page.get_by_role("button",name="Show QR code",exact=True).click()
    expect(page.get_by_role("img",name="Scannable activity link")).to_be_visible()
    widths()
    page.get_by_role("button",name="My Activities",exact=True).click()
    page.get_by_role("button",name="Refresh",exact=True).click()
    expect(page.get_by_role("button",name="Cancel request",exact=True)).to_be_visible()
    widths()
    page.get_by_role("button",name="Profile",exact=True).click()
    expect(page.get_by_role("heading",name="Discovery preferences")).to_be_visible()
    widths()
    page.get_by_role("button",name="Alerts",exact=True).click()
    expect(page.get_by_text("No alerts yet.",exact=True)).to_be_visible()
    widths()
    page.get_by_role("button",name="+ Create",exact=True).click()
    page.get_by_role("button",name="Next",exact=True).click()
    page.get_by_label("Title",exact=True).fill("Evening walk")
    page.get_by_label("What will you do?").fill("Walk in the park")
    page.get_by_role("button",name="Next",exact=True).click()
    tomorrow = page.evaluate("(()=>{const d=new Date();d.setDate(d.getDate()+1);return [d.getFullYear(),('0'+(d.getMonth()+1)).slice(-2),('0'+d.getDate()).slice(-2)].join('-')})()")
    expect(page.get_by_label("Date (YYYY-MM-DD)")).to_have_value(tomorrow)
    page.get_by_label("Date (YYYY-MM-DD)").fill("2020-01-01")
    page.get_by_label("Approximate area",exact=True).fill("Central")
    page.get_by_role("button",name="Next",exact=True).click()
    expect(page.get_by_text("Choose a future date",exact=True)).to_be_visible()
    page.reload()
    page.get_by_role("button",name="+ Create",exact=True).click()
    page.get_by_role("button",name="Next",exact=True).click()
    expect(page.get_by_label("Title",exact=True)).to_have_value("Evening walk")
    page.emulate_media(color_scheme="dark")
    expect(page.locator("html")).to_have_attribute("data-theme","dark")
    widths()
    assert not failures, failures
    print("PASS: 7 widths on sign-in, discovery, detail, my activities, profile, alerts and create. Filter/page reload, map, QR, pending refresh, future/past dates, draft reload and device color preference. Loopback API fixtures.")
    browser.close()
