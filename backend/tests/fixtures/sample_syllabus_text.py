"""
Fixture de texto del syllabus ISTQB CTFL v4.0 para pruebas.

Este archivo contiene una MUESTRA representativa del texto que
PdfExtractorService extrae del syllabus ISTQB. Se usa en tests
unitarios del TopicDetectorService para:

1. Pruebas determinísticas — el texto NUNCA cambia entre ejecuciones.
2. Velocidad — no necesitamos leer un PDF real.
3. Aislamiento — los tests no dependen de archivos externos.

IMPORTANTE:
  Este texto es una SIMPLIFICACIÓN del syllabus real. Los patrones
  FL-x.x.x y (Kn) son representativos del formato real, pero el
  contenido de texto es reducido para mantener el fixture manejable.

  En producción, el topic_detector procesará ~200K caracteres.
  Este fixture tiene ~5K caracteres — suficiente para validar la lógica.

Fuente:
  Basado en la estructura del ISTQB CTFL Syllabus v4.0.
  Los textos son adaptaciones resumidas, no copias literales.
"""

# ═══════════════════════════════════════════════════════════════
# TEXTO DE MUESTRA DEL SYLLABUS ISTQB CTFL v4.0
# ═══════════════════════════════════════════════════════════════
#
# Este string simula el output de PdfExtractorService.extract().
# Incluye:
#   - Encabezados de capítulo y sección
#   - Patrones FL-x.x.x con nivel K
#   - Texto de contenido entre tópicos
#   - Variaciones de formato (con y sin paréntesis en K)
#   - Tópicos de diferentes capítulos (1 a 6)

SAMPLE_SYLLABUS_TEXT = """
ISTQB® Certified Tester
Foundation Level Syllabus
Version 4.0

Chapter 1: Fundamentals of Testing

1.1 What is Testing?

FL-1.1.1 (K1) Identify Typical Test Objectives
Testing has different objectives depending on the context, including:
- Finding defects
- Providing confidence in the quality level
- Providing information for decision making
- Preventing defects
Testing can verify whether all specified requirements have been fulfilled.
The test objectives should be clearly defined for each test level and test type.

FL-1.1.2 (K2) Differentiate Testing from Debugging
Testing can trigger failures that are caused by defects in the software.
Debugging is the development activity that finds, analyzes, and fixes such
defects. Confirmation testing checks whether the fixes resolved the defects.
Testing is not the same as debugging: testing finds failures, debugging
finds the root cause and fixes it.

1.2 Why is Testing Necessary?

FL-1.2.1 (K2) Give Examples of Why Testing is Necessary
Testing is necessary because it helps find defects before they reach production.
Software failures have caused significant financial losses and even endangered
human lives. Rigorous testing helps to reduce the risk of such failures occurring
in an operational environment. Testing also helps to meet contractual or legal
requirements and industry-specific standards.

FL-1.2.2 (K1) Recall the Relationship between Testing and Quality Assurance
Testing is a form of quality control (QC). QC is a product-oriented, corrective
approach that focuses on those activities supporting the achievement of
appropriate levels of quality. QA is a process-oriented, preventive approach
that focuses on the implementation and improvement of processes.

FL-1.2.3 (K2) Distinguish between Root Cause, Error, Defect, and Failure
A person can make an error, which may introduce a defect into a work product.
When code with a defect is executed, it may cause a failure. The root cause
is the fundamental reason why the error occurred.

1.3 Testing Principles

FL-1.3.1 (K2) Explain the Seven Testing Principles
The seven testing principles are:
1. Testing shows the presence, not the absence of defects.
2. Exhaustive testing is impossible.
3. Early testing saves time and money.
4. Defects cluster together.
5. Tests wear out.
6. Testing is context dependent.
7. Absence-of-defects fallacy.

1.4 Test Activities, Testware and Test Roles

FL-1.4.1 (K2) Recall the Different Test Activities and Tasks
Testing involves various activities including: test planning, test monitoring and
control, test analysis, test design, test implementation, test execution, and
test completion. Each activity has specific tasks and deliverables.

FL-1.4.2 (K2) Explain the Impact of Context on the Test Process
The way testing is carried out depends on various contextual factors including
the software development lifecycle model, test levels and types, product and
project risks, business domain, operational constraints, organizational
policies and practices, required internal and external standards.

FL-1.4.3 (K2) Differentiate the Testware that Supports the Test Activities
Testware is created as output work products of the test activities. Examples
include test plans, test cases, test data, test scripts, test reports,
defect reports, traceability matrices, and test environments.

FL-1.4.4 (K2) Explain the Value of Maintaining Traceability
Traceability between the test basis, test conditions, test cases, test
procedures, and test results helps to assess test coverage and to identify
the impact of changes.

FL-1.4.5 (K2) Compare the Different Test Roles
The two main roles in testing are test management and testing. The test
management role takes overall responsibility for the test process. The testing
role takes responsibility for the engineering (technical) aspect of testing.

1.5 Essential Skills and Good Practices in Testing

FL-1.5.1 (K2) Recall the Skills Required for Testing
Generic skills needed for testing include knowledge of testing, thoroughness,
carefulness, curiosity, attention to detail, good communication skills,
analytical thinking, technical knowledge, and domain knowledge.

FL-1.5.2 (K1) Recall the Advantages of the Whole Team Approach
The whole team approach means that every team member can perform any task,
and that the entire team is responsible for quality. The whole team approach
benefits from the diverse skill sets of all team members.

FL-1.5.3 (K2) Distinguish the Benefits and Drawbacks of Independence of Testing
Independent testers can find different defects and provide an objective view.
However, too much independence can isolate testers from developers and reduce
shared responsibility for quality.

Chapter 2: Testing Throughout the Software Development Lifecycle

2.1 Testing in the Context of a Software Development Lifecycle

FL-2.1.1 (K2) Explain the Impact of the Chosen SDLC on Testing
The software development lifecycle (SDLC) model impacts testing. In sequential
models, testing activities occur after development. In iterative models,
testing happens in each iteration. The test levels, types, and techniques
depend on the SDLC model chosen.

FL-2.1.2 (K1) Recall Good Testing Practices That Apply to All SDLC Models
Good testing practices include: for every software development activity there
is a corresponding test activity; different test levels have specific objectives;
test analysis and design begin during the corresponding development phase;
testers participate in reviewing work products as soon as drafts are available.

FL-2.1.3 (K1) Recall Examples of Test-First Approaches to Development
Test-first approaches include test-driven development (TDD), acceptance
test-driven development (ATDD), and behavior-driven development (BDD). These
approaches define tests before writing the code.

FL-2.1.4 (K2) Summarize How DevOps is a Testing-Relevant Approach
DevOps is an approach that promotes collaboration between development and
operations. It enables fast feedback, shift-left testing, CI/CD pipelines,
and promotes automated testing as a key practice.

FL-2.1.5 (K2) Explain the Shift-Left Approach
The shift-left approach means testing earlier in the SDLC. This includes
reviewing requirements before coding, writing tests before code, and
performing static analysis continuously.

FL-2.1.6 (K2) Explain How Retrospectives Can Be Used as a Mechanism for Process Improvement
Retrospectives discuss what went well, what could be improved, and concrete
actions for improvement. They are used to improve the test process and
overall development practices.

2.2 Test Levels and Test Types

FL-2.2.1 (K2) Distinguish the Different Test Levels
Test levels include component testing, component integration testing, system
testing, system integration testing, and acceptance testing. Each level has
different objectives, test basis, and test objects.

FL-2.2.2 (K2) Distinguish the Different Test Types
Test types include functional testing, non-functional testing, and
white-box testing. Functional testing evaluates functions, non-functional
testing evaluates characteristics like performance, and white-box testing
is based on the internal structure.

FL-2.2.3 (K2) Distinguish Confirmation Testing from Regression Testing
Confirmation testing confirms that a defect has been fixed. Regression testing
detects unintended side-effects of changes. Both are performed at all test levels.

2.3 Maintenance Testing

FL-2.3.1 (K2) Summarize Maintenance Testing and Its Triggers
Maintenance testing is performed on an existing system. Triggers include
modifications, migrations, and retirement. The scope of maintenance testing
depends on the risk of change, the size of the system, and the size of the change.

Chapter 3: Static Testing

3.1 Static Testing Basics

FL-3.1.1 (K1) Recognize Types of Products That Can Be Examined by the Different Static Testing Techniques
Static testing can examine almost any work product including requirements,
user stories, source code, test plans, test cases, web pages, and contracts.

FL-3.1.2 (K2) Explain the Value of Static Testing
Static testing finds defects early, before dynamic testing. It can detect
defects that are hard to find in dynamic testing, such as requirement
ambiguities, design deficiencies, and coding standards violations.

FL-3.1.3 (K2) Compare and Contrast Static and Dynamic Testing
Static testing finds defects directly in work products, while dynamic testing
finds failures caused by defects during software execution. Static testing
can find defects in non-executable work products.

3.2 Feedback and Review Process

FL-3.2.1 (K1) Recall the Benefits of Early and Frequent Stakeholder Feedback
Early and frequent feedback helps avoid misunderstandings, clarify customer
requirements, and ensure the team builds the right product.

FL-3.2.2 (K2) Summarize the Activities of the Review Process
The review process includes planning, initiation, individual review, communication
and analysis, and fixing and reporting. Each step has specific tasks.

FL-3.2.3 (K1) Recall Which Responsibilities Are Assigned to the Principal Roles When Conducting Reviews
Review roles include author, management, facilitator, review leader, reviewers,
and scribe. Each role has specific responsibilities.

FL-3.2.4 (K2) Compare and Contrast the Different Review Types
Review types include informal review, walkthrough, technical review, and
inspection. They differ in formality, purpose, and process followed.

FL-3.2.5 (K1) Recall the Factors That Contribute to a Successful Review
Success factors include clear objectives, the right people, sufficient time,
management support, and a culture of learning.

Chapter 4: Test Analysis and Design

4.1 Test Techniques Overview

FL-4.1.1 (K2) Distinguish Black-Box, White-Box and Experience-Based Test Techniques
Black-box techniques are based on specifications, white-box on internal structure,
and experience-based on the tester's skill and intuition.

4.2 Black-Box Test Techniques

FL-4.2.1 (K3) Use Equivalence Partitioning to Derive Test Cases
Equivalence partitioning divides data into groups where all members are expected
to be processed the same way. Each partition must be covered by at least one test case.

FL-4.2.2 (K3) Use Boundary Value Analysis to Derive Test Cases
Boundary value analysis tests the boundaries of equivalence partitions. Defects
are more likely at the boundaries than in the middle of a partition.

FL-4.2.3 (K3) Use Decision Table Testing to Derive Test Cases
Decision tables show combinations of conditions and their resulting actions.
Each combination is a test case.

FL-4.2.4 (K3) Use State Transition Testing to Derive Test Cases
State transition testing uses a state machine model to derive test cases.
Tests cover state transitions, including valid and invalid transitions.

4.3 White-Box Test Techniques

FL-4.3.1 (K2) Explain Statement Testing
Statement testing exercises the executable statements in the code. Statement
coverage measures the percentage of statements exercised by tests.

FL-4.3.2 (K2) Explain Branch Testing
Branch testing exercises the branches (decision outcomes) in the code. Branch
coverage measures the percentage of branches exercised by tests. 100% branch
coverage implies 100% statement coverage.

FL-4.3.3 (K2) Explain the Value of White-Box Testing
White-box testing can find defects in code even when the specification is
vague, incomplete, or outdated. It ensures that the internal structure has
been tested thoroughly.

4.4 Experience-Based Test Techniques

FL-4.4.1 (K2) Explain Error Guessing
Error guessing is a technique where the tester uses experience to guess where
defects might exist. Error guessing is enhanced by using a list of common
defects and failures.

FL-4.4.2 (K2) Explain Exploratory Testing
Exploratory testing is an experience-based approach where the tester simultaneously
learns about the test object, designs tests, and executes them. It is useful
when there is limited documentation.

FL-4.4.3 (K2) Explain Checklist-Based Testing
Checklist-based testing uses a list of items to be tested or conditions to be verified.
Checklists are built based on experience, standards, or user requirements.

4.5 Collaboration-Based Test Approaches

FL-4.5.1 (K2) Explain How to Write User Stories in Collaboration with Developers and Business Representatives
User stories are written collaboratively to capture user needs, business value,
and expected behavior. Good user stories are understandable, testable, and small
enough to be implemented within an iteration.

FL-4.5.2 (K2) Classify the Different Options for Writing Acceptance Criteria
Acceptance criteria can be written using rule-oriented or scenario-oriented
formats. Scenario-oriented criteria often use Given-When-Then to describe
preconditions, actions, and expected outcomes.

FL-4.5.3 (K3) Use Acceptance Test-Driven Development to Derive Test Cases
Acceptance test-driven development derives test cases from acceptance criteria
before implementation. The tests clarify expectations and support shared
understanding between business, development, and testing roles.

Chapter 5: Managing the Test Activities

5.1 Test Planning

FL-5.1.1 (K2) Exemplify the Purpose and Content of a Test Plan
A test plan documents the approach, resources, schedule, and scope of testing.
It serves as a communication document and a basis for control.

FL-5.1.2 (K1) Recognize How a Tester Adds Value to Iteration and Release Planning
Testers contribute to iteration planning by estimating testing effort, identifying
test conditions, and participating in risk assessment.

FL-5.1.3 (K2) Compare and Contrast Entry Criteria and Exit Criteria
Entry criteria define preconditions for starting a test activity. Exit criteria
define conditions for completing a test activity. They are also called
definition of ready and definition of done.

FL-5.1.4 (K3) Use Estimation Techniques to Calculate the Required Test Effort
Estimation techniques include expert judgment, historical data, and metrics-based
approaches. Test effort includes time for analysis, design, implementation,
execution, and completion activities.

FL-5.1.5 (K3) Apply Test Case Prioritization
Test cases can be prioritized based on risk, coverage, and requirements. Risk-based
prioritization executes the most important tests first.

FL-5.1.6 (K1) Recall the Concepts of Test Pyramid
The test pyramid shows that there should be many unit tests, fewer integration
tests, and even fewer end-to-end tests. This optimizes testing cost and speed.

FL-5.1.7 (K2) Summarize the Testing Quadrants and Their Relationships with Test Levels and Test Types
The testing quadrants classify tests along two dimensions: technology-facing vs.
business-facing, and supporting the team vs. critiquing the product.

5.2 Risk Management

FL-5.2.1 (K1) Identify the Level of Risk Using Likelihood and Impact
Risk level is determined by the likelihood of occurrence and the impact if it
occurs. High likelihood and high impact means high risk.

FL-5.2.2 (K2) Distinguish Between Project Risks and Product Risks
Project risks relate to the management of the project. Product risks relate to
the quality characteristics of the product.

FL-5.2.3 (K2) Explain How Product Risk Analysis Influences Testing
Product risk analysis helps determine the thoroughness and scope of testing.
Higher risk items receive more testing. Risk analysis influences test planning,
test technique selection, and test execution order.

FL-5.2.4 (K2) Explain How Product Risk Analysis Influences the Thoroughness and Scope of Testing
Higher product risks require more thorough testing. The scope and depth of
testing are adjusted based on the risk analysis results.

5.3 Test Monitoring, Test Control and Test Completion

FL-5.3.1 (K1) Recall Metrics Used for Testing
Testing metrics include test case execution status, defect density, test
coverage, task completion, and resource consumption.

FL-5.3.2 (K2) Summarize the Purposes, Content, and Audiences for Test Reports
Test reports communicate testing status and results. Test progress reports are
for ongoing activities; test completion reports summarize overall results.

FL-5.3.3 (K2) Exemplify How to Communicate the Status of Testing
Testing status is communicated through metrics, dashboards, reports, and meetings.
The communication format depends on the audience.

5.4 Configuration Management

FL-5.4.1 (K2) Summarize How Configuration Management Supports Testing
Configuration management ensures that test items, test environments, and testware
are identified, version-controlled, tracked, and maintained throughout the project.

5.5 Defect Management

FL-5.5.1 (K3) Prepare a Defect Report
A defect report should contain enough information to reproduce, analyze, and
resolve the defect. It typically includes summary, steps to reproduce, expected
and actual results, severity, priority, environment, and attachments.

Chapter 6: Test Tools

6.1 Tool Support for Testing

FL-6.1.1 (K2) Explain How Different Types of Test Tools Support Testing
Test tools include management tools, static testing tools, test design tools,
test execution tools, and non-functional testing tools. Each type supports
different test activities.

6.2 Benefits and Risks of Test Automation

FL-6.2.1 (K1) Recall the Benefits and Risks of Test Automation
Benefits include reduced time for repetitive tests, increased consistency,
and faster feedback. Risks include maintenance costs, unrealistic expectations,
and reliance on the tool vendor.
"""


# ═══════════════════════════════════════════════════════════════
# TÓPICOS ESPERADOS DEL SYLLABUS ISTQB CTFL v4.0
# ═══════════════════════════════════════════════════════════════
#
# Esta lista contiene TODOS los códigos FL-x.x.x que el topic
# detector debería encontrar en un syllabus completo.
# Se usa en tests para validar que no faltan tópicos.
#
# Fuente: Tabla de objetivos de aprendizaje del syllabus v4.0.

EXPECTED_TOPIC_CODES: list[str] = [
    # Capítulo 1: Fundamentals of Testing
    "FL-1.1.1",
    "FL-1.1.2",
    "FL-1.2.1",
    "FL-1.2.2",
    "FL-1.2.3",
    "FL-1.3.1",
    "FL-1.4.1",
    "FL-1.4.2",
    "FL-1.4.3",
    "FL-1.4.4",
    "FL-1.4.5",
    "FL-1.5.1",
    "FL-1.5.2",
    "FL-1.5.3",
    # Capítulo 2: Testing Throughout the SDLC
    "FL-2.1.1",
    "FL-2.1.2",
    "FL-2.1.3",
    "FL-2.1.4",
    "FL-2.1.5",
    "FL-2.1.6",
    "FL-2.2.1",
    "FL-2.2.2",
    "FL-2.2.3",
    "FL-2.3.1",
    # Capítulo 3: Static Testing
    "FL-3.1.1",
    "FL-3.1.2",
    "FL-3.1.3",
    "FL-3.2.1",
    "FL-3.2.2",
    "FL-3.2.3",
    "FL-3.2.4",
    "FL-3.2.5",
    # Capítulo 4: Test Analysis and Design
    "FL-4.1.1",
    "FL-4.2.1",
    "FL-4.2.2",
    "FL-4.2.3",
    "FL-4.2.4",
    "FL-4.3.1",
    "FL-4.3.2",
    "FL-4.3.3",
    "FL-4.4.1",
    "FL-4.4.2",
    "FL-4.4.3",
    "FL-4.5.1",
    "FL-4.5.2",
    "FL-4.5.3",
    # Capítulo 5: Managing the Test Activities
    "FL-5.1.1",
    "FL-5.1.2",
    "FL-5.1.3",
    "FL-5.1.4",
    "FL-5.1.5",
    "FL-5.1.6",
    "FL-5.1.7",
    "FL-5.2.1",
    "FL-5.2.2",
    "FL-5.2.3",
    "FL-5.2.4",
    "FL-5.3.1",
    "FL-5.3.2",
    "FL-5.3.3",
    "FL-5.4.1",
    "FL-5.5.1",
    # Capítulo 6: Test Tools
    "FL-6.1.1",
    "FL-6.2.1",
]

# Distribución esperada de niveles K en el syllabus v4.0
EXPECTED_K_DISTRIBUTION: dict[str, int] = {
    "K1": 14,
    "K2": 42,
    "K3": 8,
}

# Total de tópicos esperados
EXPECTED_TOTAL_TOPICS: int = len(EXPECTED_TOPIC_CODES)  # 64
