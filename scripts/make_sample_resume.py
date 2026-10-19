"""Generates public/sample-resume.pdf — a realistic resume with deliberate,
fixable flaws (passive bullets, missing metrics, a two-column block, mixed
date formats, a non-standard bullet glyph, tiny footer text) so the ATS audit
has something meaningful to annotate in demos.

    python3 scripts/make_sample_resume.py
"""
from pathlib import Path
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor

OUT = Path(__file__).resolve().parent.parent / "public" / "sample-resume.pdf"
W, H = letter
L, R = 54, W - 54
INK, MUTED, RULE = HexColor("#18181b"), HexColor("#52525b"), HexColor("#d4d4d8")

c = canvas.Canvas(str(OUT), pagesize=letter)
c.setTitle("Jordan Lee — Resume")
c.setAuthor("Jordan Lee")
y = H - 58


def text(x, s, size=10, font="Helvetica", color=INK):
    c.setFont(font, size)
    c.setFillColor(color)
    c.drawString(x, y, s)


def right(s, size=9.5, font="Helvetica", color=MUTED):
    c.setFont(font, size)
    c.setFillColor(color)
    c.drawRightString(R, y, s)


def header(label):
    global y
    y -= 20
    text(L, label, 10.5, "Helvetica-Bold")
    c.setStrokeColor(RULE)
    c.setLineWidth(0.6)
    c.line(L, y - 4, R, y - 4)
    y -= 17


def wrap(s, width, size):
    words, lines, cur = s.split(), [], ""
    for w in words:
        trial = (cur + " " + w).strip()
        if c.stringWidth(trial, "Helvetica", size) > width:
            lines.append(cur)
            cur = w
        else:
            cur = trial
    if cur:
        lines.append(cur)
    return lines


def bullet(s, glyph="•", size=10):
    global y
    lines = wrap(s, R - L - 14, size)
    text(L + 2, glyph, size)
    for i, ln in enumerate(lines):
        text(L + 14, ln, size)
        y -= 13.2
    y -= 1.5


def role(title, company, dates):
    global y
    y -= 3
    text(L, title, 10.5, "Helvetica-Bold")
    c.setFont("Helvetica-Bold", 10.5)
    tw = c.stringWidth(title, "Helvetica-Bold", 10.5)
    text(L + tw, f"  |  {company}", 10.5, "Helvetica", MUTED)
    right(dates)
    y -= 15


# ---- Header -------------------------------------------------------------
text(L, "Jordan Lee", 22, "Helvetica-Bold")
y -= 18
text(L, "Senior Product Manager", 11.5, "Helvetica", MUTED)
y -= 15
text(L, "San Francisco, CA  ·  jordan.lee@email.com  ·  (415) 555-0136", 9.5, "Helvetica", MUTED)
y -= 4

# ---- Summary ------------------------------------------------------------
header("SUMMARY")
for ln in wrap(
    "Results-driven product manager and team player with 7+ years building B2B and consumer health products. "
    "Comfortable taking ambiguous problems from discovery to launch with engineering, design and data partners.",
    R - L, 10,
):
    text(L, ln, 10)
    y -= 13.2

# ---- Experience ---------------------------------------------------------
header("EXPERIENCE")
role("Senior Product Manager", "Lumen Health", "Mar 2021 – Present")
bullet("Led the redesign of patient onboarding, increasing activation by 34% across 120K monthly users.")
bullet("Responsible for managing the product roadmap and working with engineering teams on quarterly planning.")
bullet("Launched a self-serve billing portal that cut support tickets by 41% and saved $310K annually.")
bullet("Worked on the analytics dashboard used by the leadership team for weekly business reviews.")
bullet("I owned weekly stakeholder updates and my squads' sprint rituals across three product teams.")

role("Product Manager", "Brightcart", "06/2018 – 02/2021")
bullet("Grew repeat purchases 22% by introducing personalized recommendations with the data science team.")
bullet("Helped with the launch of a new mobile checkout experience for returning customers.")
bullet("Duties included writing PRDs, running user interviews, coordinating QA and release notes.")
bullet(
    "Drove the end-to-end discovery, scoping, prioritisation and delivery process for the merchant tools area, "
    "partnering with sales, support, legal and finance stakeholders to define requirements and align on what "
    "should be built each quarter."
)

role("Associate Product Manager", "Northwind Labs", "Jul 2016 – May 2018")
bullet("Assisted in gathering requirements for the B2B reporting module.")
bullet("Analyzed funnel data in SQL to find drop-off points, improving trial-to-paid conversion by 9%.")

# ---- Two-column Skills | Certifications (parser hazard) -------------------
y -= 18
text(L, "SKILLS", 10.5, "Helvetica-Bold")
text(W / 2 + 6, "CERTIFICATIONS", 10.5, "Helvetica-Bold")
c.setStrokeColor(RULE)
c.line(L, y - 4, R, y - 4)
y -= 17
left = ["Product strategy, roadmapping, PRDs", "SQL, Amplitude, Mixpanel, Figma", "A/B testing, user research, agile", "Stakeholder management, OKRs"]
rightcol = ["Certified Scrum Product Owner (CSPO)", "Pragmatic Institute Foundations", "Google Analytics Individual Qualification", "Reforge Product Strategy Program"]
for a, b in zip(left, rightcol):
    text(L, a, 10)
    text(W / 2 + 6, b, 10)
    y -= 13.5

# ---- Projects (non-standard glyph) ---------------------------------------
header("PROJECTS")
bullet("Built a Chrome extension that turns meeting notes into Jira tickets, used by 2,000+ product managers.", glyph="»")
bullet("Mentoring early-career PMs through the ADPList community on discovery and prioritisation.", glyph="»")

# ---- Education ------------------------------------------------------------
header("EDUCATION")
text(L, "B.S. Cognitive Science", 10.5, "Helvetica-Bold")
text(L + c.stringWidth("B.S. Cognitive Science", "Helvetica-Bold", 10.5), "  |  University of California, San Diego", 10.5, "Helvetica", MUTED)
right("2012 – 2016")
y -= 26

text(L, "References available upon request.", 6.5, "Helvetica", MUTED)

c.showPage()
c.save()
print(f"wrote {OUT}")
