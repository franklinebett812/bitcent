const modal = document.getElementById("modal");
const closeBtn = document.getElementById("close");
const modalTitle = document.getElementById("modalTitle");
const modalIntro = document.getElementById("modalIntro");
const formMsg = document.getElementById("formMsg");
const authForm = document.getElementById("authForm");
const authSubmit = document.getElementById("authSubmit");
const switchMode = document.getElementById("switchMode");
const switchText = document.getElementById("switchText");
const googleSignIn = document.getElementById("googleSignIn");
const authPanel = document.getElementById("authPanel");
const checkoutPanel = document.getElementById("checkoutPanel");
const checkoutForm = document.getElementById("checkoutForm");
const checkoutCancel = document.getElementById("checkoutCancel");
const packageSelect = document.getElementById("packageSelect");
const checkoutPlanBadge = document.getElementById("checkoutPlanBadge");
const checkoutSubmit = document.getElementById("checkoutSubmit");
const loginBtn = document.querySelector('[data-modal="login"]');
const signupBtn = document.querySelector('[data-modal="signup"]');
let authMode = "login";
let selectedPlan = 'Starter Growth Package';
let selectedPlanFromCheckout = selectedPlan;

const nowPaymentsApiBase = 'https://mineforge.pythonanywhere.com/api';

const planCatalog = {
  'Starter Growth Package': { amount: 20, fullPrice: '$20', minimumPayment: '$1', productName: 'Starter Growth Package' },
  'Balanced Portfolio Package': { amount: 50, fullPrice: '$50', minimumPayment: '$1', productName: 'Balanced Portfolio Package' },
  'Long-Term Builder Package': { amount: 100, fullPrice: '$100', minimumPayment: '$1', productName: 'Long-Term Builder Package' },
  'Digital Asset Plus Package': { amount: 150, fullPrice: '$150', minimumPayment: '$1', productName: 'Digital Asset Plus Package' },
  'Advanced Strategy Package': { amount: 500, fullPrice: '$500', minimumPayment: '$1', productName: 'Advanced Strategy Package' },
  'Premium Diversification Package': { amount: 1000, fullPrice: '$1000', minimumPayment: '$1', productName: 'Premium Diversification Package' },
  'Institutional Select Package': { amount: 2500, fullPrice: '$2500', minimumPayment: '$10', productName: 'Institutional Select Package' },
  'Custom Wealth Strategy Package': { amount: 5000, fullPrice: '$5000', minimumPayment: '$50', productName: 'Custom Wealth Strategy Package' }
};

const firebaseConfig = {
  apiKey: "AIzaSyBvwUm8jy9YkoZ0FujYYtJ_NCgd7re0xaM",
  authDomain: "bitcent-3d893.firebaseapp.com",
  databaseURL: "https://bitcent-3d893-default-rtdb.firebaseio.com",
  projectId: "bitcent-3d893",
  storageBucket: "bitcent-3d893.firebasestorage.app",
  messagingSenderId: "215457961439",
  appId: "1:215457961439:web:5fb98a9692ac98eb84a06a"
};

const firebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.apiKey.startsWith("AIza") &&
  firebaseConfig.authDomain &&
  firebaseConfig.projectId &&
  firebaseConfig.appId
);

let firebaseAuth = null;
let firebaseDb = null;
let googleProvider = null;
let authProvider = "local";

if (firebaseConfigured && window.firebase && !firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

if (firebaseConfigured && window.firebase && firebase.apps.length) {
  firebaseAuth = firebase.auth();
  firebaseDb = firebase.database();
  googleProvider = new firebase.auth.GoogleAuthProvider();
  authProvider = "firebase";
}

const accountsKey = "cryptovaultAccounts";
const currentUserKey = "cryptovaultCurrentUser";

function readAccounts() {
  try {
    return JSON.parse(localStorage.getItem(accountsKey)) || {};
  } catch (e) {
    return {};
  }
}

function saveAccounts(accounts) {
  localStorage.setItem(accountsKey, JSON.stringify(accounts));
}

function readCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem(currentUserKey)) || null;
  } catch (e) {
    return null;
  }
}

function writeCurrentUser(user) {
  if (user) {
    localStorage.setItem(currentUserKey, JSON.stringify(user));
  } else {
    localStorage.removeItem(currentUserKey);
  }
}

function setNavForAuth(user) {
  const getStarted = document.querySelector('#navLinks a[href="#plans"]');

  if (user) {
    if (loginBtn) loginBtn.textContent = "Dashboard";
    if (signupBtn) signupBtn.textContent = "Log out";
    if (getStarted) getStarted.textContent = "Explore plans";
  } else {
    if (loginBtn) loginBtn.textContent = "Log in";
    if (signupBtn) signupBtn.textContent = "Sign up";
    if (getStarted) getStarted.textContent = "Get Started";
  }
}

function syncAuthNav(user, provider = 'local') {
  if (!user) return;

  const account = {
    email: user.email || user,
    provider
  };

  writeCurrentUser(account);
  setNavForAuth(account);
}

function redirectAfterSuccess(user) {
  if (!user) return;

  if (window.location.hash !== '#plans') {
    window.location.hash = '#plans';
  }

  const plans = document.getElementById('plans');
  if (plans) {
    plans.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function populatePlanOptions() {
  if (!packageSelect) return;

  packageSelect.innerHTML = '';
  Object.keys(planCatalog).forEach(planName => {
    const option = document.createElement('option');
    option.value = planName;
    option.textContent = planName;
    packageSelect.appendChild(option);
  });
}

function showCheckoutPanel(planName) {
  if (!authPanel || !checkoutPanel || !packageSelect || !checkoutPlanBadge || !formMsg || !modal) return;

  const resolvedPlan = planName || selectedPlan || 'Starter Growth Package';
  selectedPlan = resolvedPlan;
  selectedPlanFromCheckout = resolvedPlan;

  populatePlanOptions();
  packageSelect.value = resolvedPlan;
  checkoutPlanBadge.textContent = resolvedPlan;

  authPanel.hidden = true;
  checkoutPanel.hidden = false;
  formMsg.textContent = '';
  modalTitle.textContent = 'Complete your investment profile';
  modalIntro.textContent = 'Choose your package and enter your basic details to continue.';
  modal.classList.add('show');

  const currentUser = readCurrentUser();
  const email = currentUser && currentUser.email ? currentUser.email : '';
  if (email && document.getElementById('customerEmail')) {
    document.getElementById('customerEmail').value = email;
  }
}

function showAuthPanel() {
  if (!authPanel || !checkoutPanel || !formMsg) return;

  authPanel.hidden = false;
  checkoutPanel.hidden = true;
  formMsg.textContent = '';

  if (authMode === 'signup') {
    modalTitle.textContent = 'Create your account';
    modalIntro.textContent = 'Create your secure investor account.';
    authSubmit.textContent = 'Create account';
    switchText.textContent = 'Already have an account?';
    switchMode.textContent = 'Log in';
  } else {
    modalTitle.textContent = 'Welcome back';
    modalIntro.textContent = 'Sign in to access your account.';
    authSubmit.textContent = 'Continue';
    switchText.textContent = 'No account yet?';
    switchMode.textContent = 'Create one';
  }
}

async function saveLeadToFirebase(data) {
  if (!firebaseConfigured) return;

  const createdAt = new Date().toISOString();
  const payload = {
    ...data,
    createdAt,
    packageName: data.packageName,
    fullName: data.fullName,
    email: data.email,
    phone: data.phone,
    address: data.address,
    city: data.city,
    country: data.country,
    orderId: data.orderId
  };

  const databaseUrl = `${firebaseConfig.databaseURL || 'https://mineforge-563c9-default-rtdb.firebaseio.com'}/leads.json`;

  try {
    const response = await fetch(databaseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      return;
    }

    throw new Error('REST lead write failed');
  } catch (error) {
    if (firebaseDb) {
      const ref = firebaseDb.ref('leads');
      await ref.push(payload);
      return;
    }

    throw new Error('Unable to write lead details to Firebase Realtime Database');
  }
}

async function createNowPaymentsInvoice(user, leadData) {
  if (!selectedPlan || !planCatalog[selectedPlan]) {
    return;
  }

  const plan = planCatalog[selectedPlan];
  const email = (leadData && leadData.email) || (user && user.email) || readCurrentUser()?.email || '';
  if (!email) {
    return;
  }

  const orderId = `order-${Date.now()}-${Math.round(Math.random() * 100000)}`;
  const payload = {
    orderId,
    order: {
      price: plan.fullPrice,
      fullPrice: plan.fullPrice,
      minimumPayment: plan.minimumPayment,
      productName: plan.productName,
      customerEmail: email,
      paymentType: 'full'
    }
  };

  try {
    formMsg.textContent = 'Saving details...';
    if (leadData) {
      try {
        await saveLeadToFirebase({
          packageName: selectedPlan,
          fullName: leadData.fullName,
          email: leadData.email,
          phone: leadData.phone,
          address: leadData.address,
          city: leadData.city,
          country: leadData.country,
          orderId
        });
      } catch (error) {
        console.warn('Unable to save lead to Firebase:', error);
      }
    }

    formMsg.textContent = 'Creating invoice...';
    const response = await fetch(`${nowPaymentsApiBase}/create-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok || !data.paymentUrl) {
      throw new Error(data.error || 'Unable to create an invoice.');
    }

    formMsg.textContent = 'Payment invoice created. Redirecting...';
    if (data.paymentUrl) {
      window.location.href = data.paymentUrl;
    }
  } catch (error) {
    formMsg.textContent = error.message || 'Unable to create an invoice.';
  }
}

function openAuthModal(mode) {
  authMode = mode;

  if (mode === 'signup') {
    modalTitle.textContent = 'Create your account';
    modalIntro.textContent = 'Create your secure investor account.';
    authSubmit.textContent = 'Create account';
    switchText.textContent = 'Already have an account?';
    switchMode.textContent = 'Log in';
  } else {
    modalTitle.textContent = 'Welcome back';
    modalIntro.textContent = 'Sign in to access your account.';
    authSubmit.textContent = 'Continue';
    switchText.textContent = 'No account yet?';
    switchMode.textContent = 'Create one';
  }

  formMsg.textContent = '';
  modal.classList.add('show');
}

function createLocalUser(email, password) {
  const emailKey = email.trim().toLowerCase();
  const accounts = readAccounts();

  if (accounts[emailKey]) {
    throw new Error('EMAIL_EXISTS');
  }

  accounts[emailKey] = { email: emailKey, password, provider: 'local' };
  saveAccounts(accounts);

  writeCurrentUser({ email: emailKey, provider: 'local' });
  setNavForAuth({ email: emailKey, provider: 'local' });
}

function signInLocal(email, password) {
  const emailKey = email.trim().toLowerCase();
  const accounts = readAccounts();

  if (!accounts[emailKey] || accounts[emailKey].password !== password) {
    throw new Error('INVALID_CREDENTIALS');
  }

  writeCurrentUser({ email: emailKey, provider: accounts[emailKey].provider || 'local' });
  setNavForAuth({ email: emailKey, provider: accounts[emailKey].provider || 'local' });
}

if (loginBtn) {
  loginBtn.addEventListener('click', () => {
    if (authProvider === 'firebase' && firebaseAuth && firebaseAuth.currentUser) {
      redirectAfterSuccess(firebaseAuth.currentUser);
      return;
    }

    if (authProvider === 'local' && readCurrentUser()) {
      redirectAfterSuccess(readCurrentUser());
      return;
    }

    openAuthModal('login');
  });
}

if (signupBtn) {
  signupBtn.addEventListener('click', () => {
    if (authProvider === 'firebase' && firebaseAuth && firebaseAuth.currentUser) {
      firebaseAuth.signOut().then(() => {
        setNavForAuth(null);
        writeCurrentUser(null);
        formMsg.textContent = 'You have been logged out.';
      });
      return;
    }

    if (authProvider === 'local' && readCurrentUser()) {
      writeCurrentUser(null);
      setNavForAuth(null);
      formMsg.textContent = 'You have been logged out.';
      return;
    }

    openAuthModal('signup');
  });
}

if (packageSelect) {
  packageSelect.disabled = true;
  packageSelect.setAttribute('aria-readonly', 'true');
}

document.querySelectorAll('.choose').forEach(btn => {
  btn.addEventListener('click', () => {
    selectedPlan = btn.dataset.plan;
    selectedPlanFromCheckout = btn.dataset.plan;

    const loggedLocalUser = readCurrentUser();
    const loggedFirebaseUser = authProvider === 'firebase' && firebaseAuth && firebaseAuth.currentUser;

    if (loggedLocalUser || loggedFirebaseUser) {
      const loggedUser = loggedFirebaseUser
        ? { email: loggedFirebaseUser.email, provider: 'firebase' }
        : { email: loggedLocalUser.email, provider: loggedLocalUser.provider || 'local' };

      showCheckoutPanel(selectedPlan);
      const leadForm = document.getElementById('checkoutForm');
      if (leadForm) {
        document.getElementById('customerEmail').value = loggedUser.email || '';
      }
      return;
    }

    authMode = 'signup';
    modalTitle.textContent = `${btn.dataset.plan} plan`;
    modalIntro.textContent = 'Create your secure investor account to start this plan.';
    authSubmit.textContent = 'Create account';
    switchText.textContent = 'Already have an account?';
    switchMode.textContent = 'Log in';
    formMsg.textContent = '';
    modal.classList.add('show');
  });
});

closeBtn.addEventListener('click', () => {
  modal.classList.remove('show');
  showAuthPanel();
});

modal.addEventListener('click', e => {
  if (e.target === modal) {
    modal.classList.remove('show');
    showAuthPanel();
  }
});

checkoutCancel.addEventListener('click', () => {
  showAuthPanel();
});

checkoutForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const chosenPackage = packageSelect && packageSelect.value ? packageSelect.value : selectedPlan;
  selectedPlan = chosenPackage;
  selectedPlanFromCheckout = chosenPackage;

  if (!selectedPlan || !planCatalog[selectedPlan]) {
    formMsg.textContent = 'Choose a valid package first.';
    return;
  }

  const fullName = document.getElementById('fullName').value.trim();
  const email = document.getElementById('customerEmail').value.trim().toLowerCase();
  const phone = document.getElementById('phone').value.trim();
  const address = document.getElementById('address').value.trim();
  const city = document.getElementById('city').value.trim();
  const country = document.getElementById('country').value.trim();

  if (!fullName || !email || !phone || !address || !city || !country) {
    formMsg.textContent = 'Please complete all required details.';
    return;
  }

  const user = readCurrentUser() || { email, provider: authProvider };
  const lead = {
    packageName: selectedPlan,
    fullName,
    email,
    phone,
    address,
    city,
    country
  };

  formMsg.textContent = 'Saving profile...';
  try {
    modal.classList.remove('show');
    await createNowPaymentsInvoice(user, lead);
    redirectAfterSuccess(user);
  } catch (error) {
    formMsg.textContent = 'Unable to save details. Please try again.';
  }
});

switchMode.addEventListener('click', () => {
  if (authMode === 'signup') {
    openAuthModal('login');
  } else {
    openAuthModal('signup');
  }
});

if (googleSignIn) {
  googleSignIn.addEventListener('click', () => {
    if (authProvider === 'firebase' && firebaseAuth && googleProvider) {
      formMsg.textContent = 'Connecting Google account...';
      googleProvider.setCustomParameters({ prompt: 'select_account' });
      firebaseAuth.signInWithRedirect(googleProvider);
      return;
    }

    const emailInput = authForm.querySelector('input[type="email"]');
    const email = (emailInput && emailInput.value.trim()) || 'google.user@cryptovault.local';

    try {
      const key = email.toLowerCase();
      if (!readAccounts()[key]) {
        createLocalUser(email, 'google-user');
      }

      const googleUser = { email: key, provider: 'google' };
      writeCurrentUser(googleUser);
      setNavForAuth(googleUser);

      formMsg.textContent = 'Google account connected.';
      modal.classList.add('show');
      showCheckoutPanel(selectedPlan || 'Starter Growth Package');
      document.getElementById('customerEmail').value = googleUser.email;
      if (checkoutForm) {
        checkoutForm.querySelector('#fullName').value = 'Google Investor';
      }
    } catch (e) {
      formMsg.textContent = 'Google account could not be created locally.';
    }
  });
}

if (authProvider === 'firebase' && firebaseAuth) {
  firebaseAuth.getRedirectResult()
    .then(result => {
      if (result.user) {
        const user = {
          email: result.user.email,
          provider: 'firebase'
        };

        writeCurrentUser(user);
        setNavForAuth(user);
        formMsg.textContent = 'Google account connected.';
        modal.classList.add('show');
        showCheckoutPanel(selectedPlan || 'Starter Growth Package');
        if (document.getElementById('customerEmail')) {
          document.getElementById('customerEmail').value = user.email;
        }
      }
    })
    .catch(error => {
      formMsg.textContent = 'Google authentication failed.';
      console.error(error);
    });
}

authForm.addEventListener('submit', e => {
  e.preventDefault();

  if (authProvider === 'firebase' && !firebaseAuth) {
    formMsg.textContent = 'Firebase authentication is not configured yet.';
    return;
  }

  const email = authForm.querySelector('input[type="email"]').value.trim().toLowerCase();
  const password = authForm.querySelector('input[type="password"]').value.trim();

  if (!email || !password) {
    formMsg.textContent = 'Enter both email and password.';
    return;
  }

  if (password.length < 6) {
    formMsg.textContent = 'Password must be at least 6 characters.';
    return;
  }

  if (authProvider === 'firebase') {
    if (authMode === 'signup') {
      formMsg.textContent = 'Creating account...';
      firebaseAuth.createUserWithEmailAndPassword(email, password)
        .then(user => {
          syncAuthNav(user, 'firebase');
          formMsg.textContent = 'Account created. You are signed in.';
          modal.classList.add('show');
          showCheckoutPanel(selectedPlan || 'Starter Growth Package');
          if (document.getElementById('customerEmail')) {
            document.getElementById('customerEmail').value = email;
          }
        })
        .catch(error => {
          if (error.code === 'auth/email-already-in-use') {
            formMsg.textContent = 'An account already exists for this email. Please log in.';
          } else if (error.code === 'auth/invalid-email') {
            formMsg.textContent = 'Enter a valid email address.';
          } else if (error.code === 'auth/weak-password') {
            formMsg.textContent = 'Password must be at least 6 characters.';
          } else {
            formMsg.textContent = 'Unable to create account with Firebase.';
          }
        });
    } else {
      formMsg.textContent = 'Signing in...';
      firebaseAuth.signInWithEmailAndPassword(email, password)
        .then(user => {
          syncAuthNav(user, 'firebase');
          formMsg.textContent = 'Welcome back! You are signed in.';
          modal.classList.add('show');
          showCheckoutPanel(selectedPlan || 'Starter Growth Package');
          if (document.getElementById('customerEmail')) {
            document.getElementById('customerEmail').value = email;
          }
        })
        .catch(error => {
          if (error.code === 'auth/user-not-found') {
            formMsg.textContent = 'No account found. Create a new account to continue.';
          } else if (error.code === 'auth/wrong-password') {
            formMsg.textContent = 'Incorrect password.';
          } else if (error.code === 'auth/invalid-email') {
            formMsg.textContent = 'Enter a valid email address.';
          } else {
            formMsg.textContent = 'Unable to authenticate with Firebase.';
          }
        });
    }
  } else {
    if (authMode === 'signup') {
      try {
        createLocalUser(email, password);
        syncAuthNav({ email, provider: 'local' }, 'local');
        formMsg.textContent = 'Account created. You are signed in.';
        modal.classList.add('show');
        showCheckoutPanel(selectedPlan || 'Starter Growth Package');
        if (document.getElementById('customerEmail')) {
          document.getElementById('customerEmail').value = email;
        }
      } catch (e) {
        formMsg.textContent = 'An account for this email already exists. Please log in.';
      }
    } else {
      try {
        signInLocal(email, password);
        syncAuthNav({ email, provider: 'local' }, 'local');
        formMsg.textContent = 'Welcome back! You are signed in.';
        modal.classList.add('show');
        showCheckoutPanel(selectedPlan || 'Starter Growth Package');
        if (document.getElementById('customerEmail')) {
          document.getElementById('customerEmail').value = email;
        }
      } catch (e) {
        formMsg.textContent = 'Invalid email or password.';
      }
    }
  }
});

document.querySelectorAll('.faq-item').forEach(item => {
  item.addEventListener('click', () => item.classList.toggle('open'));
});

const menuBtn = document.getElementById('menuBtn');
const navLinks = document.getElementById('navLinks');
menuBtn.addEventListener('click', () => {
  const open = navLinks.style.display === 'flex';
  navLinks.style.display = open ? '' : 'flex';

  if (!open) {
    navLinks.style.position = 'absolute';
    navLinks.style.top = '76px';
    navLinks.style.left = '0';
    navLinks.style.right = '0';
    navLinks.style.padding = '20px 6%';
    navLinks.style.background = '#07111f';
    navLinks.style.flexDirection = 'column';
  }
});

setNavForAuth(readCurrentUser());
