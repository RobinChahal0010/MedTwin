"""
MedTwin — one-page Streamlit frontend.
Run with:  streamlit run app.py
Talks to TWO backends:
  - Node.js auth service (login/signup)   -> NODE_URL
  - Python FastAPI AI service (everything else) -> FASTAPI_URL
Edit the two URLs below if your ports differ from the defaults.
"""
import requests
import streamlit as st

NODE_URL = "http://localhost:3000/api"      # your teammate's auth server
FASTAPI_URL = "http://localhost:8000"   # this project's FastAPI server

st.set_page_config(page_title="MedTwin", page_icon="🩺", layout="centered")
st.title("🩺 MedTwin")
st.caption("Educational demo only — not medical advice. Use dummy patient data.")

# ---- session state ---------------------------------------------------------
if "user_id" not in st.session_state:
    st.session_state.user_id = None
if "twin" not in st.session_state:
    st.session_state.twin = None
if "chat" not in st.session_state:
    st.session_state.chat = []  # list of (question, answer_dict)


# ---- 1. Login / signup ------------------------------------------------------
if not st.session_state.user_id:
    st.subheader("Log in or sign up")
    tab_login, tab_signup = st.tabs(["Log in", "Sign up"])

    with tab_login:
        email = st.text_input("Email", key="login_email")
        password = st.text_input("Password", type="password", key="login_pw")
        if st.button("Log in"):
            try:
                r = requests.post(f"{NODE_URL}/auth/login",
                                  json={"emailId": email, "password": password})
                r.raise_for_status()
                st.session_state.user_id = r.json()["user"]["id"]
                st.rerun()
            except Exception as e:
                st.error(f"Login failed: {e}")

    with tab_signup:
        username2 = st.text_input("Username", key="signup_username")
        email2 = st.text_input("Email", key="signup_email")
        password2 = st.text_input("Password", type="password", key="signup_pw")
        if st.button("Sign up"):
            try:
                r = requests.post(f"{NODE_URL}/auth/signup",
                                  json={"username": username2, "emailId": email2,
                                        "password": password2})
                r.raise_for_status()
                st.success("Account created — please log in.")
            except Exception as e:
                st.error(f"Signup failed: {e}")

    st.stop()  # don't show the rest of the app until logged in


# ---- logged in: sidebar ------------------------------------------------------
st.sidebar.success(f"Logged in (user_id: {st.session_state.user_id[:8]}...)")
mode = st.sidebar.radio("Answer style", ["patient", "clinician"])
if st.sidebar.button("Log out"):
    st.session_state.user_id = None
    st.session_state.twin = None
    st.session_state.chat = []
    st.rerun()


# ---- 2. Upload a report ------------------------------------------------------
st.subheader("1. Upload your lab report")
uploaded = st.file_uploader("PDF or CSV — sample/dummy data only", type=["pdf", "csv"])
if uploaded and st.button("Build my digital twin"):
    with st.spinner("Reading report and building your twin..."):
        try:
            files = {"file": (uploaded.name, uploaded.getvalue())}
            r = requests.post(f"{FASTAPI_URL}/twin/upload",
                              params={"user_id": st.session_state.user_id}, files=files)
            r.raise_for_status()
            st.session_state.twin = r.json()
            st.success("Twin created.")
        except Exception as e:
            st.error(f"Upload failed: {e}")

# Load an existing twin if we don't have one in memory yet
if st.session_state.twin is None:
    try:
        r = requests.get(f"{FASTAPI_URL}/twin/{st.session_state.user_id}")
        if r.ok and "error" not in r.json():
            st.session_state.twin = r.json()
    except Exception:
        pass


# ---- 3. Twin summary ----------------------------------------------------------
st.subheader("2. Your digital twin")
if st.session_state.twin:
    twin = st.session_state.twin
    cols = st.columns(3)
    for i, (field, value) in enumerate(twin.get("values", {}).items()):
        label_info = twin.get("labels", {}).get(field, {})
        status = label_info.get("status", "unknown")
        badge = {"at_goal": "🟢", "needs_attention": "🔴"}.get(status, "⚪")
        with cols[i % 3]:
            st.metric(field, value if value is not None else "—", help=label_info.get("note"))
            st.caption(f"{badge} {status}")

    risk = twin.get("risk_poor_control")
    if risk is not None:
        st.progress(risk, text=f"Estimated risk of poor glucose control: {risk:.0%}")
else:
    st.info("Upload a report above to see your twin here.")


# ---- 4. Chat ------------------------------------------------------------------
st.subheader("3. Ask a question")
question = st.text_input("e.g. \"What is my HbA1c goal?\" or \"What if my HbA1c stayed high for 6 months?\"")
if st.button("Ask") and question:
    with st.spinner("Thinking..."):
        try:
            r = requests.post(f"{FASTAPI_URL}/chat",
                              json={"user_id": st.session_state.user_id,
                                    "question": question, "mode": mode})
            r.raise_for_status()
            st.session_state.chat.insert(0, (question, r.json()))
        except Exception as e:
            st.error(f"Chat failed: {e}")

for q, a in st.session_state.chat:
    with st.chat_message("user"):
        st.write(q)
    with st.chat_message("assistant"):
        st.write(a.get("answer", "(no answer)"))
        if a.get("confidence") is not None:
            st.caption(f"Confidence: {a['confidence']:.0%}")
        if a.get("sources"):
            with st.expander("Sources"):
                for s in a["sources"]:
                    st.write(f"- {s}")