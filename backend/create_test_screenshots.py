"""
Creates 5 realistic QA/SDET job posting screenshots for Phase 8 testing.
Each image mimics a LinkedIn-style job card.
Run: python create_test_screenshots.py
"""
from PIL import Image, ImageDraw, ImageFont
import os

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "test_screenshots")
os.makedirs(OUTPUT_DIR, exist_ok=True)

JOBS = [
    {
        "filename": "job1_tcs_qa_automation.png",
        "company": "Tata Consultancy Services",
        "title": "QA Automation Engineer",
        "location": "Bengaluru, India • Full-time",
        "experience": "2–4 Years",
        "skills": [
            "Selenium WebDriver", "Java", "TestNG", "Maven",
            "REST API Testing", "SQL", "Git", "Agile/Scrum",
            "JIRA", "Postman",
        ],
        "responsibilities": [
            "Design and develop automated test scripts using Selenium and Java",
            "Build and maintain regression and smoke test suites",
            "Integrate automated tests into CI/CD pipelines using Jenkins",
            "Perform REST API testing using Postman and REST Assured",
            "Collaborate with developers in Agile sprints",
            "Log, track and verify defects using JIRA",
            "Generate test execution reports and metrics",
        ],
    },
    {
        "filename": "job2_infosys_sdet.png",
        "company": "Infosys",
        "title": "SDET Engineer",
        "location": "Hyderabad, India • Full-time",
        "experience": "2–5 Years",
        "skills": [
            "Java", "Selenium WebDriver", "REST Assured", "Cucumber BDD",
            "JUnit", "SQL", "Jenkins", "Docker basics", "Git", "Postman",
        ],
        "responsibilities": [
            "Develop and maintain automated test frameworks using Java and Selenium",
            "Write BDD scenarios using Cucumber and Gherkin syntax",
            "Perform API testing using REST Assured and Postman",
            "Execute SQL queries for database validation",
            "Participate in CI/CD pipeline integration using Jenkins",
            "Conduct root cause analysis for defects and production issues",
            "Work closely with product teams in Agile environment",
        ],
    },
    {
        "filename": "job3_wipro_software_tester.png",
        "company": "Wipro Technologies",
        "title": "Software Test Engineer",
        "location": "Pune, India • Full-time",
        "experience": "1–3 Years",
        "skills": [
            "Manual Testing", "Selenium", "Python", "API Testing",
            "SQL", "JIRA", "TestNG", "Git", "Agile", "Postman",
        ],
        "responsibilities": [
            "Create and execute manual and automated test cases",
            "Perform functional, regression and sanity testing",
            "Test REST APIs using Postman and validate JSON responses",
            "Write SQL queries for backend data validation",
            "Report and track defects in JIRA",
            "Participate in daily standups and sprint reviews",
            "Maintain test documentation and traceability matrix",
        ],
    },
    {
        "filename": "job4_capgemini_qa_lead.png",
        "company": "Capgemini",
        "title": "QA Lead",
        "location": "Chennai, India • Full-time",
        "experience": "4–7 Years",
        "skills": [
            "Selenium WebDriver", "Java", "TestNG", "REST API Testing",
            "SQL", "JIRA", "Jenkins", "CI/CD", "Agile/Scrum", "Team Leadership",
        ],
        "responsibilities": [
            "Lead a team of QA engineers and provide technical guidance",
            "Design end-to-end test strategy and test plans",
            "Build scalable automation frameworks using Selenium and Java",
            "Oversee API testing and database validation processes",
            "Drive CI/CD integration for automated test execution",
            "Conduct code reviews for test scripts",
            "Report quality metrics and test coverage to stakeholders",
        ],
    },
    {
        "filename": "job5_accenture_automation_engineer.png",
        "company": "Accenture",
        "title": "Automation Test Engineer",
        "location": "Bengaluru, India • Full-time",
        "experience": "2–4 Years",
        "skills": [
            "Selenium WebDriver", "Java / Python", "TestNG", "REST Assured",
            "SQL & database validation", "Git", "Jenkins", "Postman",
            "Agile methodology", "JIRA",
        ],
        "responsibilities": [
            "Develop automation scripts using Selenium WebDriver with Java or Python",
            "Perform API validation using REST Assured and Postman",
            "Execute regression suites and report test coverage",
            "Integrate tests into CI/CD using Jenkins pipelines",
            "Validate data integrity using SQL queries",
            "Identify, document and track defects in JIRA",
            "Collaborate with cross-functional Agile teams",
        ],
    },
]


def make_job_image(job: dict) -> str:
    """Generate a LinkedIn-style job posting PNG."""
    W, H = 900, 820
    img = Image.new("RGB", (W, H), "#FFFFFF")
    draw = ImageDraw.Draw(img)

    # Fonts — use default PIL font (always available)
    try:
        font_xl   = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 22)
        font_lg   = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 17)
        font_md   = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 14)
        font_sm   = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 12)
        font_bold = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 16)
    except Exception:
        font_xl = font_lg = font_md = font_sm = font_bold = ImageFont.load_default()

    y = 20

    # LinkedIn-style header bar
    draw.rectangle([0, 0, W, 6], fill="#0A66C2")

    # Company + role header
    y = 30
    draw.text((30, y), job["company"], font=font_lg, fill="#0A66C2")
    y += 32
    draw.text((30, y), job["title"], font=font_xl, fill="#000000")
    y += 34
    draw.text((30, y), job["location"], font=font_md, fill="#666666")
    y += 22
    draw.text((30, y), f"Experience: {job['experience']}", font=font_md, fill="#666666")
    y += 28

    # Divider
    draw.line([30, y, W - 30, y], fill="#E0E0E0", width=1)
    y += 16

    # Required Skills
    draw.text((30, y), "Required Skills", font=font_bold, fill="#000000")
    y += 22

    # Skills as pill tags
    x_pill = 30
    pill_h = 26
    for skill in job["skills"]:
        skill_w = len(skill) * 7 + 20
        if x_pill + skill_w > W - 30:
            x_pill = 30
            y += pill_h + 6
        draw.rounded_rectangle([x_pill, y, x_pill + skill_w, y + pill_h],
                                radius=12, outline="#0A66C2", fill="#EBF3FB")
        draw.text((x_pill + 10, y + 5), skill, font=font_sm, fill="#0A66C2")
        x_pill += skill_w + 8
    y += pill_h + 20

    # Divider
    draw.line([30, y, W - 30, y], fill="#E0E0E0", width=1)
    y += 16

    # Responsibilities
    draw.text((30, y), "Key Responsibilities", font=font_bold, fill="#000000")
    y += 22
    for resp in job["responsibilities"]:
        # Word-wrap at ~75 chars
        words = resp.split()
        line, lines = "", []
        for w in words:
            if len(line) + len(w) + 1 <= 78:
                line = (line + " " + w).strip()
            else:
                lines.append(line)
                line = w
        if line:
            lines.append(line)

        first = True
        for ln in lines:
            prefix = "• " if first else "  "
            draw.text((30, y), prefix + ln, font=font_sm, fill="#333333")
            y += 18
            first = False
        y += 4

    # Footer
    y = H - 40
    draw.rectangle([0, y, W, H], fill="#F3F2EE")
    draw.text((30, y + 12), "Posted on LinkedIn  •  Apply on company website", font=font_sm, fill="#888888")

    # Border
    draw.rectangle([0, 0, W - 1, H - 1], outline="#D0D0D0", width=1)

    path = os.path.join(OUTPUT_DIR, job["filename"])
    img.save(path, "PNG", quality=95)
    return path


if __name__ == "__main__":
    print("Creating job screenshots...")
    for job in JOBS:
        path = make_job_image(job)
        print(f"  ✅ {job['filename']}  →  {path}")
    print(f"\nDone! 5 screenshots saved to: {OUTPUT_DIR}")
