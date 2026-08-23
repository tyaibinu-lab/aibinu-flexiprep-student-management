import {
  Users,
  UserPlus,
  Search,
  Eye,
  Pencil,
  ChevronLeft,
  Save,
  GraduationCap,
  Filter,
  Camera,
  RefreshCw,
  CreditCard
} from "lucide-react";
import React, { useEffect, useMemo, useState } from 
import "./styles.css";

/* =========================
   BASIC DATA
========================= */

const states = [
  "Abia",
  "Adamawa",
  "Akwa Ibom",
  "Anambra",
  "Bauchi",
  "Bayelsa",
  "Benue",
  "Borno",
  "Cross River",
  "Delta",
  "Ebonyi",
  "Edo",
  "Ekiti",
  "Enugu",
  "Gombe",
  "Imo",
  "Jigawa",
  "Kaduna",
  "Kano",
  "Katsina",
  "Kebbi",
  "Kogi",
  "Kwara",
  "Lagos",
  "Nasarawa",
  "Niger",
  "Ogun",
  "Ondo",
  "Osun",
  "Oyo",
  "Plateau",
  "Rivers",
  "Sokoto",
  "Taraba",
  "Yobe",
  "Zamfara",
  "FCT"
];

const lgas = {
  Kwara: [
    "Asa",
    "Baruten",
    "Edu",
    "Ekiti",
    "Ifelodun",
    "Ilorin East",
    "Ilorin South",
    "Ilorin West",
    "Irepodun",
    "Isin",
    "Kaiama",
    "Moro",
    "Offa",
    "Oke Ero",
    "Oyun",
    "Patigi"
  ],

  Lagos: [
    "Agege",
    "Alimosho",
    "Amuwo-Odofin",
    "Apapa",
    "Badagry",
    "Epe",
    "Eti-Osa",
    "Ibeju-Lekki",
    "Ikeja",
    "Ikorodu",
    "Kosofe",
    "Lagos Island",
    "Lagos Mainland",
    "Mushin",
    "Ojo",
    "Surulere"
  ],

  Oyo: [
    "Akinyele",
    "Atiba",
    "Egbeda",
    "Ibadan North",
    "Ibadan North-East",
    "Ibadan North-West",
    "Ibadan South-East",
    "Ibadan South-West",
    "Oyo East",
    "Oyo West"
  ]
};

const programmes = [
  "WAEC / NECO",
  "UTME",
  "IJMB",
  "JUPEB",
  "Holiday Programme"
];

const classes = [
  "SS1 Science",
  "SS2 Science",
  "SS3 Science",
  "JAMB Physics",
  "JAMB Chemistry",
  "IJMB Science",
  "JUPEB Science"
];

const blankStudent = {
  firstName: "",
  lastName: "",
  gender: "",
  dob: "",
  phone: "",
  email: "",
  address: "",
  nationality: "Nigerian",
  religion: "",
  state: "",
  lga: "",
  parent: "",
  parentPhone: "",
  className: "",
  programme: "",
  status: "Active",
  photo: null
};


/* =========================
   STUDENT ID
========================= */

function nextId(students) {
  const prefix = `AF-${new Date().getFullYear()}-`;

  const numbers = students
    .map(student => {
      if (!student.id || !student.id.startsWith(prefix)) {
        return 0;
      }

      return Number(student.id.replace(prefix, "")) || 0;
    });

  const nextNumber = Math.max(0, ...numbers) + 1;

  return `${prefix}${String(nextNumber).padStart(4, "0")}`;
}


/* =========================
   APP
========================= */

function App() {

  const [students, setStudents] = useState([]);

  const [view, setView] = useState("list");
  
  const [view, setView] = useState("list");
  
  const [paymentView, setPaymentView] = useState("list");
  
  const [selected, setSelected] = useState(null);

  const [editing, setEditing] = useState(null);

  const [search, setSearch] = useState("");

  const [programmeFilter, setProgrammeFilter] = useState("All");

  const [statusFilter, setStatusFilter] = useState("All");

  const [loading, setLoading] = useState(true);

  const [message, setMessage] = useState("");

  const [error, setError] = useState("");


  /* =========================
     LOAD STUDENTS FROM AIRTABLE
  ========================= */

  async function loadStudents() {

    setLoading(true);
    setError("");

    try {

      const response = await fetch("/api/students", {
        method: "GET"
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error?.message ||
          data.error ||
          "Unable to load students."
        );
      }

      const records = data.records || [];

setStudents(records);

return records;

    } catch (err) {

      console.error(err);

      setError(
        err.message ||
        "Unable to connect to the student database."
      );

    } finally {

      setLoading(false);

    }
  }


  /* Load Airtable students when app opens */

  useEffect(() => {
    loadStudents();
  }, []);


  /* =========================
     FILTER STUDENTS
  ========================= */

  const filteredStudents = useMemo(() => {

    const text = search.toLowerCase().trim();

    return students.filter(student => {

      const searchable = `
        ${student.id || ""}
        ${student.firstName || ""}
        ${student.lastName || ""}
        ${student.phone || ""}
        ${student.parent || ""}
      `.toLowerCase();

      const matchesSearch =
        !text ||
        searchable.includes(text);

      const matchesProgramme =
        programmeFilter === "All" ||
        student.programme === programmeFilter;

      const matchesStatus =
        statusFilter === "All" ||
        student.status === statusFilter;

      return (
        matchesSearch &&
        matchesProgramme &&
        matchesStatus
      );

    });

  }, [
    students,
    search,
    programmeFilter,
    statusFilter
  ]);


  /* =========================
     SAVE STUDENT TO AIRTABLE
  ========================= */

  async function saveStudent(formData) {

    setMessage("");
    setError("");

    const id =
      editing?.id ||
      nextId(students);

    const student = {
      ...formData,

      id,

      fullName:
        `${formData.firstName} ${formData.lastName}`.trim(),

      registrationDate:
        editing?.registrationDate ||
        new Date().toISOString().slice(0, 10)
    };


    try {

      const response = await fetch("/api/students", {
        method: editing ? "PUT" : "POST",

        headers: {
          "Content-Type": "application/json"
        },

        body: JSON.stringify({
  ...student,
  airtableId: editing?.airtableId
})
      });


      const data = await response.json();


      if (!response.ok) {

        throw new Error(
          data.error?.message ||
          data.error ||
          "Student registration failed."
        );

      }


      /* Add the new student immediately */

      setStudents(previous => {

        if (editing) {

          return previous.map(item =>
            item.id === id
              ? student
              : item
          );

        }

        return [
          student,
          ...previous
        ];

      });


      setEditing(null);

setMessage(
  "Student registered successfully!"
);

setView("profile");

/* Refresh from Airtable and get the complete record */
const refreshedStudents = await loadStudents();

/* Select the Airtable record, including airtableId */
const savedStudent =
  refreshedStudents.find(item => item.id === id);

if (savedStudent) {
  setSelected(savedStudent);
}


    } catch (err) {

      console.error(err);

      setError(
        err.message ||
        "Student registration failed."
      );

      throw err;
    }
  }


  /* =========================
     NEW STUDENT
  ========================= */

  function startNewStudent() {

    setEditing(null);
    setSelected(null);
    setMessage("");
    setError("");
    setView("form");
  }


  /* =========================
     EDIT STUDENT
  ========================= */

  function editStudent(student) {

    setEditing(student);
    setSelected(student);
    setMessage("");
    setError("");
    setView("form");
  }


  /* =========================
     VIEW PROFILE
  ========================= */

  function viewStudent(student) {

    setSelected(student);
    setMessage("");
    setError("");
    setView("profile");
  }


  return (
    <>
      <header>

        <div className="brand">

          <div className="logo">
            AF
          </div>

          <div>
            <b>AIBINU</b>
            <small>
              FLEXIPREP EDUCONSULT
            </small>
          </div>

        </div>

        <strong>
          Student Management
        </strong>

      </header>


      {message && (
        <div className="success">
          {message}
        </div>
      )}


      {error && (
        <div className="error">
          {error}
        </div>
      )}


      {view === "list" && (

        <List
          students={filteredStudents}
          totalStudents={students.length}
          search={search}
          setSearch={setSearch}
          programmeFilter={programmeFilter}
          setProgrammeFilter={setProgrammeFilter}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          newStudent={startNewStudent}
          viewStudent={viewStudent}
          editStudent={editStudent}
          loading={loading}
          refresh={loadStudents}
        />

      )}


      {view === "form" && (

        <StudentForm
          initial={editing || blankStudent}
          editing={!!editing}
          cancel={() => {
            setView(
              editing
                ? "profile"
                : "list"
            );
          }}
          save={saveStudent}
        />

      )}


      {view === "profile" && selected && (

        <Profile
          student={selected}
          back={() => setView("list")}
          edit={() => editStudent(selected)}
        />

      )}

    </>
  );
}


/* =========================
   STUDENT LIST
========================= */

function List({
  students,
  totalStudents,
  search,
  setSearch,
  programmeFilter,
  setProgrammeFilter,
  statusFilter,
  setStatusFilter,
  newStudent,
  viewStudent,
  editStudent,
  loading,
  refresh
}) {

  const activeCount =
    students.filter(
      student => student.status === "Active"
    ).length;


  const programmeCount =
    new Set(
      students.map(
        student => student.programme
      )
    ).size;


  return (

    <main>

      <div className="head">

        <div>

          <label>
            AIBINU FLEXIPREP
          </label>

          <h1>
            Students
          </h1>

          <p>
            Register, search and manage
            student records.
          </p>

        </div>


        <button
          className="primary"
          onClick={newStudent}
        >
          <UserPlus />
          Register Student
        </button>

      </div>


      <div className="cards">

        <div>
          <Users />

          <span>
            Total
            <strong>
              {totalStudents}
            </strong>
          </span>
        </div>


        <div>
          <GraduationCap />

          <span>
            Programmes
            <strong>
              {programmeCount}
            </strong>
          </span>
        </div>


        <div>
          <Filter />

          <span>
            Active
            <strong>
              {activeCount}
            </strong>
          </span>
        </div>

      </div>


      <div className="toolbar">

        <div className="search">

          <Search />

          <input
            placeholder="Search ID, name, phone or parent..."
            value={search}
            onChange={event =>
              setSearch(event.target.value)
            }
          />

        </div>


        <select
          value={programmeFilter}
          onChange={event =>
            setProgrammeFilter(event.target.value)
          }
        >

          <option value="All">
            All
          </option>

          {programmes.map(programme => (

            <option
              key={programme}
              value={programme}
            >
              {programme}
            </option>

          ))}

        </select>


        <select
          value={statusFilter}
          onChange={event =>
            setStatusFilter(event.target.value)
          }
        >

          <option value="All">
            All
          </option>

          <option value="Active">
            Active
          </option>

          <option value="Inactive">
            Inactive
          </option>

          <option value="Graduated">
            Graduated
          </option>

          <option value="Withdrawn">
            Withdrawn
          </option>

        </select>


        <button
          className="secondary"
          onClick={refresh}
          disabled={loading}
        >
          <RefreshCw />
          Refresh
        </button>

      </div>


      <div className="table">

        {loading ? (

          <div className="empty">
            Loading students from Airtable...
          </div>

        ) : students.length === 0 ? (

          <div className="empty">

            No students found.

            <br />

            <button
              className="primary"
              onClick={newStudent}
              style={{ marginTop: "15px" }}
            >
              Register First Student
            </button>

          </div>

        ) : (

          <table>

            <thead>

              <tr>

                <th>
                  STUDENT
                </th>

                <th>
                  ID
                </th>

                <th>
                  GENDER
                </th>

                <th>
                  CLASS
                </th>

                <th>
                  PROGRAMME
                </th>

                <th>
                  PHONE
                </th>

                <th>
                  STATUS
                </th>

                <th>
                </th>

              </tr>

            </thead>


            <tbody>

              {students.map(student => (

                <tr key={student.id}>

                  <td>

                    <button
                      className="name"
                      onClick={() =>
                        viewStudent(student)
                      }
                    >

                      <i>
                        {(student.firstName || "?")[0]}
                        {(student.lastName || "?")[0]}
                      </i>

                      <span>

                        <b>
                          {student.fullName ||
                            `${student.firstName || ""} ${student.lastName || ""}`}
                        </b>

                        <small>
                          {student.parent || ""}
                        </small>

                      </span>

                    </button>

                  </td>


                  <td>
                    {student.id}
                  </td>


                  <td>
                    {student.gender}
                  </td>


                  <td>
                    {student.className}
                  </td>


                  <td>
                    {student.programme}
                  </td>


                  <td>
                    {student.phone}
                  </td>


                  <td>

                    <em className="pill">
                      {student.status}
                    </em>

                  </td>


                  <td>

                    <button
                      className="icon"
                      onClick={() =>
                        viewStudent(student)
                      }
                    >
                      <Eye />
                    </button>


                    <button
                      className="icon"
                      onClick={() =>
                        editStudent(student)
                      }
                    >
                      <Pencil />
                    </button>

                  </td>

                </tr>

              ))}

            </tbody>

          </table>

        )}

      </div>


      <footer>
        AIBINU FLEXIPREP EDUCONSULT —
        Student Management System
      </footer>

    </main>
  );
}


/* =========================
   REGISTRATION FORM
========================= */

function StudentForm({
  initial,
  editing,
  cancel,
  save
}) {

  const [form, setForm] =
    useState({
      ...blankStudent,
      ...initial
    });


  const [formError, setFormError] =
    useState("");


  const [saving, setSaving] =
    useState(false);


  function put(field, value) {

    setForm(previous => ({
      ...previous,
      [field]: value
    }));

  }


  async function submit(event) {
  event.preventDefault();

  setFormError("");
  setSaving(true);

  try {
    const requiredFields = [
      ["firstName", "First Name"],
      ["lastName", "Last Name"],
      ["gender", "Gender"],
      ["phone", "Phone"],
      ["parent", "Parent / Guardian"],
      ["parentPhone", "Parent Phone"],
      ["className", "Class"]
    ];

    for (const [field, label] of requiredFields) {
      if (!String(form[field] ?? "").trim()) {
        throw new Error(`${label} is required.`);
      }
    }

    await save(form);

setFormError("");
  } catch (error) {
    console.error("Registration error:", error);
    setFormError(error.message || "Unable to register student.");
  } finally {
    setSaving(false);
  }
}
  const lgaOptions =
    form.state
      ? lgas[form.state] || []
      : [];


  return (

    <main>

      <button
        className="back"
        onClick={cancel}
        type="button"
      >
        <ChevronLeft />
        Back to Students
      </button>


      <div className="head">

        <div>

          <label>
            STUDENT REGISTRATION
          </label>

          <h1>
            {editing
              ? "Edit Student"
              : "Register Student"}
          </h1>

          <p>
            Complete the approved
            AIBINU student biodata.
          </p>

        </div>


        {editing && (

          <b className="id">
            {initial.id}
          </b>

        )}

      </div>


      <form
        className="form"
        onSubmit={submit}
      >


        <Section title="Personal Information">

          <div className="grid">

            <Field
              label="First Name"
              required
              value={form.firstName}
              onChange={value =>
                put("firstName", value)
              }
            />


            <Field
              label="Last Name"
              required
              value={form.lastName}
              onChange={value =>
                put("lastName", value)
              }
            />


            <SelectField
              label="Gender"
              required
              value={form.gender}
              onChange={value =>
                put("gender", value)
              }
              options={[
                "Male",
                "Female"
              ]}
            />


            <Field
              label="Date of Birth"
              type="date"
              value={form.dob}
              onChange={value =>
                put("dob", value)
              }
            />


            <Field
              label="Phone"
              required
              value={form.phone}
              onChange={value =>
                put("phone", value)
              }
            />


            <Field
              label="Email"
              type="email"
              value={form.email}
              onChange={value =>
                put("email", value)
              }
            />


            <Field
              label="Nationality"
              value={form.nationality}
              onChange={value =>
                put("nationality", value)
              }
            />


            <SelectField
              label="Religion"
              value={form.religion}
              onChange={value =>
                put("religion", value)
              }
              options={[
                "Christianity",
                "Islam",
                "Traditional",
                "Other",
                "Prefer not to say"
              ]}
            />


            <Field
              label="Address"
              value={form.address}
              onChange={value =>
                put("address", value)
              }
              full
            />

          </div>

        </Section>


        <Section title="Origin">

          <div className="grid">

            <SelectField
              label="State of Origin"
              value={form.state}
              onChange={value => {

                put("state", value);
                put("lga", "");

              }}
              options={states}
            />


            <SelectField
              label="LGA of Origin"
              value={form.lga}
              onChange={value =>
                put("lga", value)
              }
              options={lgaOptions}
            />

          </div>

        </Section>


        <Section title="Parent / Guardian">

          <div className="grid">

            <Field
              label="Parent / Guardian"
              required
              value={form.parent}
              onChange={value =>
                put("parent", value)
              }
            />


            <Field
              label="Parent Phone"
              required
              value={form.parentPhone}
              onChange={value =>
                put("parentPhone", value)
              }
            />

          </div>

        </Section>


        <Section title="Enrolment">

          <div className="grid">

            <SelectField
              label="Class"
              required
              value={form.className}
              onChange={value =>
                put("className", value)
              }
              options={classes}
            />


            <SelectField
              label="Programme"
              required
              value={form.programme}
              onChange={value =>
                put("programme", value)
              }
              options={programmes}
            />


            <SelectField
              label="Status"
              value={form.status}
              onChange={value =>
                put("status", value)
              }
              options={[
                "Active",
                "Inactive",
                "Graduated",
                "Withdrawn"
              ]}
            />


            <div className="photo">

              <Camera />

              <span>
                Photo attachment
                coming soon
              </span>

            </div>

          </div>

        </Section>


        {formError && (

          <div className="error">
            {formError}
          </div>

        )}


        <div className="actions">

          <button
            type="button"
            className="secondary"
            onClick={cancel}
            disabled={saving}
          >
            Cancel
          </button>


          <button
            type="submit"
            className="primary"
            disabled={saving}
          >

            <Save />

            {saving
              ? "Saving..."
              : editing
                ? "Save Changes"
                : "Register Student"}

          </button>

        </div>

      </form>

    </main>
  );
}


/* =========================
   FORM SECTION
========================= */

function Section({
  title,
  children
}) {

  return (

    <section className="section">

      <h2>
        {title}
      </h2>

      {children}

    </section>

  );
}


/* =========================
   TEXT FIELD
========================= */

function Field({
  label,
  value,
  onChange,
  type = "text",
  required = false,
  full = false
}) {

  return (

    <label
      className={
        full
          ? "field full"
          : "field"
      }
    >

      {label}

      {required && (
        <em>*</em>
      )}

      <input
        type={type}
        value={value || ""}
        required={required}
        onChange={event =>
          onChange(event.target.value)
        }
      />

    </label>

  );
}


/* =========================
   SELECT FIELD
========================= */

function SelectField({
  label,
  value,
  onChange,
  options,
  required = false
}) {

  return (

    <label className="field">

      {label}

      {required && (
        <em>*</em>
      )}

      <select
        value={value || ""}
        required={required}
        onChange={event =>
          onChange(event.target.value)
        }
      >

        <option value="">
          Select...
        </option>


        {options.map(option => (

          <option
            key={option}
            value={option}
          >
            {option}
          </option>

        ))}

      </select>

    </label>

  );
}


/* =========================
   STUDENT PROFILE
========================= */

function Profile({
  student,
  back,
  edit
}) {

  return (

    <main>

      <button
        className="back"
        onClick={back}
      >
        <ChevronLeft />
        Back to Students
      </button>


      <div className="profile">

        <i>
          {(student.firstName || "?")[0]}
          {(student.lastName || "?")[0]}
        </i>


        <div>

          <label>
            STUDENT PROFILE
          </label>

          <h1>
            {student.fullName ||
              `${student.firstName || ""} ${student.lastName || ""}`}
          </h1>

          <p>
            {student.id}
            {" • "}
            {student.programme}
            {" • "}
            {student.className}
          </p>

        </div>


        <button
          className="secondary"
          onClick={edit}
        >
          <Pencil />
          Edit
        </button>

      </div>


      <div className="profileGrid">

        <Info
          title="Personal Information"
          rows={[
            ["Student ID", student.id],
            [
              "Full Name",
              student.fullName ||
              `${student.firstName || ""} ${student.lastName || ""}`
            ],
            ["Gender", student.gender],
            ["Date of Birth", student.dob || "—"],
            ["Phone", student.phone],
            ["Email", student.email || "—"],
            ["Nationality", student.nationality || "—"],
            ["Religion", student.religion || "—"]
          ]}
        />


        <Info
          title="Origin & Guardian"
          rows={[
            [
              "State of Origin",
              student.state || "—"
            ],
            [
              "LGA of Origin",
              student.lga || "—"
            ],
            [
              "Address",
              student.address || "—"
            ],
            [
              "Parent / Guardian",
              student.parent || "—"
            ],
            [
              "Parent Phone",
              student.parentPhone || "—"
            ]
          ]}
        />


        <Info
          title="Enrolment"
          rows={[
            ["Class", student.className || "—"],
            ["Programme", student.programme || "—"],
            ["Status", student.status || "—"],
            [
              "Registration Date",
              student.registrationDate || "—"
            ]
          ]}
        />

      </div>

    </main>

  );
}


/* =========================
   PROFILE INFORMATION
========================= */

function Info({
  title,
  rows
}) {

  return (

    <section className="info">

      <h2>
        {title}
      </h2>


      {rows.map(row => (

        <div
          className="row"
          key={row[0]}
        >

          <span>
            {row[0]}
          </span>

          <b>
            {row[1]}
          </b>

        </div>

      ))}

    </section>

  );
}


/* =========================
   START APP
========================= */

createRoot(
  document.getElementById("root")
).render(
  <App />
);
