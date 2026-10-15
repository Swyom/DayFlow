"""Download selected Fluent Emoji 3D PNGs (MIT) and write optimized 160px copies."""
import io
import sys
import urllib.parse
import urllib.request

from PIL import Image

RAW = "https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/"
SIZE = 160

ICONS = {
    # navigation & UI
    "home": "assets/House/3D/house_3d.png",
    "habits": "assets/Seedling/3D/seedling_3d.png",
    "tasks": "assets/Spiral notepad/3D/spiral_notepad_3d.png",
    "progress": "assets/Bar chart/3D/bar_chart_3d.png",
    "games": "assets/Video game/3D/video_game_3d.png",
    "settings": "assets/Gear/3D/gear_3d.png",
    "streak": "assets/Fire/3D/fire_3d.png",
    "trophy": "assets/Trophy/3D/trophy_3d.png",
    "check": "assets/Check mark button/3D/check_mark_button_3d.png",
    "calendar": "assets/Spiral calendar/3D/spiral_calendar_3d.png",
    "chart": "assets/Chart increasing/3D/chart_increasing_3d.png",
    "apple": "assets/Red apple/3D/red_apple_3d.png",
    "joystick": "assets/Joystick/3D/joystick_3d.png",
    "snake": "assets/Snake/3D/snake_3d.png",
    "trash": "assets/Wastebasket/3D/wastebasket_3d.png",
    "info": "assets/Information/3D/information_3d.png",
    "shield": "assets/Shield/3D/shield_3d.png",
    "memo": "assets/Memo/3D/memo_3d.png",
    "sparkles": "assets/Sparkles/3D/sparkles_3d.png",
    "star": "assets/Star/3D/star_3d.png",
    "glowingStar": "assets/Glowing star/3D/glowing_star_3d.png",
    "rocket": "assets/Rocket/3D/rocket_3d.png",
    "medal": "assets/Sports medal/3D/sports_medal_3d.png",
    "footprints": "assets/Footprints/3D/footprints_3d.png",
    "target": "assets/Bullseye/3D/bullseye_3d.png",
    "party": "assets/Party popper/3D/party_popper_3d.png",
    "profile": "assets/Bust in silhouette/3D/bust_in_silhouette_3d.png",
    "bulb": "assets/Light bulb/3D/light_bulb_3d.png",
    "clipboard": "assets/Clipboard/3D/clipboard_3d.png",
    "hourglass": "assets/Hourglass not done/3D/hourglass_not_done_3d.png",
    "palette": "assets/Artist palette/3D/artist_palette_3d.png",
    # habit icons
    "water": "assets/Droplet/3D/droplet_3d.png",
    "walk": "assets/Person walking/Default/3D/person_walking_3d_default.png",
    "run": "assets/Running shoe/3D/running_shoe_3d.png",
    "workout": "assets/Person lifting weights/Default/3D/person_lifting_weights_3d_default.png",
    "bike": "assets/Bicycle/3D/bicycle_3d.png",
    "yoga": "assets/Person in lotus position/Default/3D/person_in_lotus_position_3d_default.png",
    "read": "assets/Books/3D/books_3d.png",
    "study": "assets/Graduation cap/3D/graduation_cap_3d.png",
    "language": "assets/Globe showing europe-africa/3D/globe_showing_europe-africa_3d.png",
    "journal": "assets/Writing hand/Default/3D/writing_hand_3d_default.png",
    "plant": "assets/Potted plant/3D/potted_plant_3d.png",
    "flower": "assets/Sunflower/3D/sunflower_3d.png",
    "salad": "assets/Green salad/3D/green_salad_3d.png",
    "coffee": "assets/Hot beverage/3D/hot_beverage_3d.png",
    "tea": "assets/Teacup without handle/3D/teacup_without_handle_3d.png",
    "sleep": "assets/Bed/3D/bed_3d.png",
    "moon": "assets/Crescent moon/3D/crescent_moon_3d.png",
    "sun": "assets/Sun/3D/sun_3d.png",
    "heart": "assets/Red heart/3D/red_heart_3d.png",
    "smile": "assets/Smiling face with smiling eyes/3D/smiling_face_with_smiling_eyes_3d.png",
    "meds": "assets/Pill/3D/pill_3d.png",
    "music": "assets/Musical notes/3D/musical_notes_3d.png",
    "code": "assets/Laptop/3D/laptop_3d.png",
    "money": "assets/Money bag/3D/money_bag_3d.png",
    "phone": "assets/Mobile phone off/3D/mobile_phone_off_3d.png",
    "brain": "assets/Brain/3D/brain_3d.png",
    "toothbrush": "assets/Toothbrush/3D/toothbrush_3d.png",
    "clean": "assets/Broom/3D/broom_3d.png",
    "alarm": "assets/Alarm clock/3D/alarm_clock_3d.png",
}


def main(out_dir: str) -> None:
    total = 0
    for key, path in ICONS.items():
        url = RAW + urllib.parse.quote(path)
        with urllib.request.urlopen(url, timeout=30) as r:
            data = r.read()
        im = Image.open(io.BytesIO(data))
        im.load()
        if im.format != "PNG":
            raise SystemExit(f"{key}: unexpected format {im.format}")
        im = im.convert("RGBA").resize((SIZE, SIZE), Image.LANCZOS)
        dest = f"{out_dir}/{key}.png"
        im.save(dest, "PNG", optimize=True)
        size = len(open(dest, "rb").read())
        total += size
        print(f"{key:12s} {size/1024:6.1f} KB")
    print(f"{len(ICONS)} icons, {total/1024:.0f} KB total")


if __name__ == "__main__":
    main(sys.argv[1])
