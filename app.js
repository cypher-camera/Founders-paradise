// Import Firebase modules (v9 modular syntax)
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js';
import { 
    getAuth, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged 
} from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js';
import { 
    getFirestore, 
    doc, 
    setDoc, 
    getDoc, 
    getDocs, 
    addDoc, 
    updateDoc, 
    deleteDoc, 
    collection, 
    query, 
    orderBy, 
    limit, 
    where, 
    onSnapshot, 
    runTransaction,
    serverTimestamp,
    startAfter
} from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';
import { 
    getStorage, 
    ref, 
    uploadBytesResumable, 
    getDownloadURL 
} from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-storage.js';

// Firebase configuration - EXACT config as provided
const firebaseConfig = {
    apiKey: "AIzaSyDriQPKMdRHKKRzlPVXxCCKVgp5EbFOSNg",
    authDomain: "grindpay.firebaseapp.com",
    projectId: "grindpay",
    storage : getStorage(app, "gs://grindpay.firebasestorage.app"),
    messagingSenderId: "366294485530",
    appId: "1:366294485530:web:477d43906292f347d81fa3",
    measurementId: "G-C6TYPKSXGP"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// Global variables
let currentUser = null;
let currentUserData = null;
let allPosts = [];
let filteredPosts = [];
let currentPostId = null;
let lastVisible = null;
const POSTS_PER_PAGE = 10;

// Sample courses data
const sampleCourses = [
    {
        id: "course1",
        title: "Startup Fundamentals",
        description: "Learn the basics of starting a company",
        price: "₹2,999"
    },
    {
        id: "course2", 
        title: "Investment Strategies",
        description: "Master the art of smart investing",
        price: "₹4,999"
    },
    {
        id: "course3",
        title: "Pitch Deck Mastery",
        description: "Create compelling investor presentations",
        price: "₹1,999"
    }
];

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing app...');
    
    // Initialize courses in Firestore (run once)
    initializeCourses();
    
    // Setup auth state listener
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            console.log('User authenticated:', user.uid);
            currentUser = user;
            await loadUserData();
        } else {
            console.log('No user authenticated');
            currentUser = null;
            currentUserData = null;
            showAuthSection();
        }
    });
});

// Form validation helper
function validateForm(fields) {
    const errors = [];
    
    fields.forEach(field => {
        const element = document.getElementById(field.id);
        const value = element ? element.value.trim() : '';
        
        if (field.required && !value) {
            errors.push(`${field.name} is required`);
        }
        
        if (field.type === 'email' && value) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(value)) {
                errors.push('Please enter a valid email address');
            }
        }
        
        if (field.minLength && value.length < field.minLength) {
            errors.push(`${field.name} must be at least ${field.minLength} characters`);
        }
    });
    
    return errors;
}

// Authentication Functions
async function signUp() {
    console.log('Attempting to sign up...');
    
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value.trim();
    const displayName = document.getElementById('displayName').value.trim();
    const roleElement = document.querySelector('input[name="role"]:checked');
    const role = roleElement ? roleElement.value : '';
    
    // Validate form
    const validationErrors = validateForm([
        { id: 'email', name: 'Email', required: true, type: 'email' },
        { id: 'password', name: 'Password', required: true, minLength: 6 },
        { id: 'displayName', name: 'Display Name', required: true }
    ]);
    
    if (!role) {
        validationErrors.push('Please select a role (Founder or Investor)');
    }
    
    if (validationErrors.length > 0) {
        alert('Please fix the following errors:\n' + validationErrors.join('\n'));
        return;
    }
    
    try {
        console.log('Creating user account...');
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        console.log('Saving user data to Firestore...');
        // Save user data to Firestore
        await setDoc(doc(db, 'users', user.uid), {
            displayName: displayName,
            email: email,
            role: role,
            createdAt: serverTimestamp(),
            meetingsArranged: 0,
            meetingsSuccessful: 0
        });
        
        console.log('Account created successfully for role:', role);
        alert('Account created successfully!');
    } catch (error) {
        console.error('Error creating account:', error);
        alert('Error creating account: ' + error.message);
    }
}

async function signIn() {
    console.log('Attempting to sign in...');
    
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value.trim();
    
    // Validate form
    const validationErrors = validateForm([
        { id: 'email', name: 'Email', required: true, type: 'email' },
        { id: 'password', name: 'Password', required: true }
    ]);
    
    if (validationErrors.length > 0) {
        alert('Please fix the following errors:\n' + validationErrors.join('\n'));
        return;
    }
    
    try {
        await signInWithEmailAndPassword(auth, email, password);
        console.log('Sign in successful');
    } catch (error) {
        console.error('Error signing in:', error);
        alert('Error signing in: ' + error.message);
    }
}

async function logout() {
    try {
        await signOut(auth);
        console.log('User logged out');
        showAuthSection();
    } catch (error) {
        alert('Error signing out: ' + error.message);
    }
}

// User data management
async function loadUserData() {
    try {
        console.log('Loading user data for:', currentUser.uid);
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists()) {
            currentUserData = userDoc.data();
            console.log('User data loaded:', currentUserData);
            showMainApp();
        } else {
            console.error('User data not found in Firestore');
            alert('User data not found. Please contact support.');
        }
    } catch (error) {
        console.error('Error loading user data:', error);
        alert('Error loading user data: ' + error.message);
    }
}

// UI Management
function showAuthSection() {
    console.log('Showing auth section');
    document.getElementById('authSection').style.display = 'block';
    document.getElementById('header').style.display = 'none';
    document.getElementById('mainContent').style.display = 'none';
    
    // Reset form
    document.getElementById('authForm').reset();
}

function showMainApp() {
    console.log('Showing main app for user role:', currentUserData.role);
    
    document.getElementById('authSection').style.display = 'none';
    document.getElementById('header').style.display = 'block';
    document.getElementById('mainContent').style.display = 'block';
    
    // Update user info with correct role
    document.getElementById('userInfo').innerHTML = 
        `Logged in as: ${currentUserData.displayName} (${currentUserData.role})`;
    
    // Show/hide role-specific buttons based on actual user role
    const uploadBtn = document.getElementById('uploadBtn');
    const dashboardBtn = document.getElementById('dashboardBtn');
    
    if (currentUserData.role === 'founder') {
        console.log('Setting up founder UI');
        uploadBtn.style.display = 'inline-block';
        dashboardBtn.style.display = 'inline-block';
    } else if (currentUserData.role === 'investor') {
        console.log('Setting up investor UI');
        uploadBtn.style.display = 'none';
        dashboardBtn.style.display = 'none';
    }
    
    // Show feed by default
    showFeed();
}

// Navigation functions
function showFeed() {
    console.log('Showing feed');
    hideAllSections();
    document.getElementById('feedSection').style.display = 'block';
    loadPosts();
}

function showUpload() {
    if (currentUserData.role !== 'founder') {
        alert('Only founders can upload content');
        return;
    }
    console.log('Showing upload section');
    hideAllSections();
    document.getElementById('uploadSection').style.display = 'block';
}

function showDashboard() {
    if (currentUserData.role !== 'founder') {
        alert('Only founders can access dashboard');
        return;
    }
    console.log('Showing dashboard');
    hideAllSections();
    document.getElementById('dashboardSection').style.display = 'block';
    loadDashboard();
}

function showCourses() {
    console.log('Showing courses');
    hideAllSections();
    document.getElementById('coursesSection').style.display = 'block';
    loadCourses();
}

function hideAllSections() {
    const sections = ['feedSection', 'uploadSection', 'dashboardSection', 'coursesSection', 'postDetailSection'];
    sections.forEach(section => {
        document.getElementById(section).style.display = 'none';
    });
}

// Post management
async function loadPosts() {
    try {
        console.log('Loading posts...');
        showLoading(true);
        const q = query(collection(db, 'posts'), orderBy('likesCount', 'desc'), limit(POSTS_PER_PAGE));
        const querySnapshot = await getDocs(q);
        
        allPosts = [];
        querySnapshot.forEach((doc) => {
            allPosts.push({ id: doc.id, ...doc.data() });
        });
        
        console.log('Loaded posts:', allPosts.length);
        filteredPosts = [...allPosts];
        displayPosts();
        
        if (querySnapshot.docs.length > 0) {
            lastVisible = querySnapshot.docs[querySnapshot.docs.length - 1];
        }
        
        // Show load more button if there are more posts
        document.getElementById('loadMoreBtn').style.display = 
            querySnapshot.docs.length === POSTS_PER_PAGE ? 'block' : 'none';
            
    } catch (error) {
        console.error('Error loading posts:', error);
        alert('Error loading posts: ' + error.message);
    } finally {
        showLoading(false);
    }
}

async function loadMorePosts() {
    if (!lastVisible) return;
    
    try {
        const q = query(
            collection(db, 'posts'), 
            orderBy('likesCount', 'desc'),
            startAfter(lastVisible),
            limit(POSTS_PER_PAGE)
        );
        const querySnapshot = await getDocs(q);
        
        querySnapshot.forEach((doc) => {
            allPosts.push({ id: doc.id, ...doc.data() });
        });
        
        filteredPosts = [...allPosts];
        displayPosts();
        lastVisible = querySnapshot.docs[querySnapshot.docs.length - 1];
        
        // Hide load more button if no more posts
        if (querySnapshot.docs.length < POSTS_PER_PAGE) {
            document.getElementById('loadMoreBtn').style.display = 'none';
        }
        
    } catch (error) {
        alert('Error loading more posts: ' + error.message);
    }
}

function displayPosts() {
    const container = document.getElementById('postsContainer');
    container.innerHTML = '';
    
    if (filteredPosts.length === 0) {
        container.innerHTML = '<p>No posts found. Be the first to create content!</p>';
        return;
    }
    
    filteredPosts.forEach(post => {
        const postDiv = document.createElement('div');
        postDiv.style.border = '1px solid #ccc';
        postDiv.style.padding = '15px';
        postDiv.style.margin = '10px 0';
        postDiv.style.backgroundColor = '#f9f9f9';
        
        const actionButton = post.type === 'video' ? 'Watch' : 'Read';
        const createdDate = post.createdAt ? new Date(post.createdAt.toDate()).toLocaleDateString() : 'Unknown';
        
        postDiv.innerHTML = `
            <h3>${post.title}</h3>
            <p><strong>By:</strong> ${post.ownerDisplayName}</p>
            <p>${post.description.substring(0, 200)}${post.description.length > 200 ? '...' : ''}</p>
            <p><strong>Type:</strong> ${post.type} | <strong>Likes:</strong> ${post.likesCount || 0} | <strong>Created:</strong> ${createdDate}</p>
            <p><strong>Tags:</strong> ${post.tags && post.tags.length > 0 ? post.tags.join(', ') : 'None'}</p>
            <button onclick="viewPost('${post.id}')">${actionButton}</button>
        `;
        
        container.appendChild(postDiv);
    });
}

function searchPosts() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase().trim();
    
    if (!searchTerm) {
        filteredPosts = [...allPosts];
    } else {
        filteredPosts = allPosts.filter(post => {
            const titleMatch = post.title.toLowerCase().includes(searchTerm);
            const descMatch = post.description.toLowerCase().includes(searchTerm);
            const tagMatch = post.tags && post.tags.some(tag => 
                tag.toLowerCase().includes(searchTerm));
            
            return titleMatch || descMatch || tagMatch;
        });
    }
    
    console.log(`Search for "${searchTerm}" found ${filteredPosts.length} results`);
    displayPosts();
}

function sortPosts() {
    const sortBy = document.getElementById('sortSelect').value;
    
    if (sortBy === 'likes') {
        filteredPosts.sort((a, b) => (b.likesCount || 0) - (a.likesCount || 0));
    } else if (sortBy === 'recent') {
        filteredPosts.sort((a, b) => {
            const dateA = a.createdAt ? a.createdAt.toDate() : new Date(0);
            const dateB = b.createdAt ? b.createdAt.toDate() : new Date(0);
            return dateB - dateA;
        });
    }
    
    displayPosts();
}

// Post creation
function toggleUploadFields() {
    const postType = document.querySelector('input[name="postType"]:checked').value;
    const videoSection = document.getElementById('videoUploadSection');
    
    if (postType === 'video') {
        videoSection.style.display = 'block';
    } else {
        videoSection.style.display = 'none';
    }
}

async function createPost() {
    const title = document.getElementById('postTitle').value.trim();
    const description = document.getElementById('postDescription').value.trim();
    const tags = document.getElementById('postTags').value.split(',').map(tag => tag.trim()).filter(tag => tag);
    const postType = document.querySelector('input[name="postType"]:checked').value;
    const videoFile = document.getElementById('videoFile').files[0];
    
    // Validate form
    const validationErrors = [];
    
    if (!title) validationErrors.push('Title is required');
    if (title.length > 100) validationErrors.push('Title must be 100 characters or less');
    if (!description) validationErrors.push('Description is required');
    if (postType === 'video' && !videoFile) validationErrors.push('Please select a video file for video posts');
    if (videoFile && !videoFile.type.startsWith('video/')) validationErrors.push('Please select a valid video file');
    if (videoFile && videoFile.size > 100 * 1024 * 1024) validationErrors.push('Video file must be less than 100MB');
    
    if (validationErrors.length > 0) {
        alert('Please fix the following errors:\n' + validationErrors.join('\n'));
        return;
    }
    
    try {
        let storagePath = '';
        
        if (postType === 'video' && videoFile) {
            // Upload video to Firebase Storage
            const timestamp = Date.now();
            const fileName = `${timestamp}_${videoFile.name}`;
            const storageRef = ref(storage, `videos/${currentUser.uid}/${fileName}`);
            
            document.getElementById('uploadProgress').style.display = 'block';
            
            const uploadTask = uploadBytesResumable(storageRef, videoFile);
            
            await new Promise((resolve, reject) => {
                uploadTask.on('state_changed',
                    (snapshot) => {
                        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                        document.getElementById('progressPercent').textContent = Math.round(progress) + '%';
                    },
                    (error) => reject(error),
                    async () => {
                        storagePath = `videos/${currentUser.uid}/${fileName}`;
                        resolve();
                    }
                );
            });
            
            document.getElementById('uploadProgress').style.display = 'none';
        }
        
        // Create post document in Firestore
        const postData = {
            title: title,
            description: description,
            type: postType,
            storagePath: storagePath,
            ownerId: currentUser.uid,
            ownerDisplayName: currentUserData.displayName,
            tags: tags,
            likesCount: 0,
            createdAt: serverTimestamp()
        };
        
        await addDoc(collection(db, 'posts'), postData);
        
        alert('Post created successfully!');
        console.log('Post created:', postData);
        
        // Reset form
        document.getElementById('uploadForm').reset();
        
        // Refresh feed
        showFeed();
        
    } catch (error) {
        console.error('Error creating post:', error);
        alert('Error creating post: ' + error.message);
        document.getElementById('uploadProgress').style.display = 'none';
    }
}

// Post detail view
async function viewPost(postId) {
    try {
        console.log('Viewing post:', postId);
        currentPostId = postId;
        const postDoc = await getDoc(doc(db, 'posts', postId));
        
        if (!postDoc.exists()) {
            alert('Post not found');
            return;
        }
        
        const post = postDoc.data();
        
        hideAllSections();
        document.getElementById('postDetailSection').style.display = 'block';
        
        // Display post content
        const contentDiv = document.getElementById('postDetailContent');
        const createdDate = post.createdAt ? new Date(post.createdAt.toDate()).toLocaleString() : 'Unknown';
        
        contentDiv.innerHTML = `
            <h2>${post.title}</h2>
            <p><strong>By:</strong> ${post.ownerDisplayName}</p>
            <p><strong>Type:</strong> ${post.type}</p>
            <p>${post.description}</p>
            <p><strong>Tags:</strong> ${post.tags && post.tags.length > 0 ? post.tags.join(', ') : 'None'}</p>
            <p><strong>Created:</strong> ${createdDate}</p>
        `;
        
        // Setup video player if it's a video post
        if (post.type === 'video' && post.storagePath) {
            document.getElementById('videoPlayerSection').style.display = 'block';
            const videoPlayer = document.getElementById('videoPlayer');
            
            try {
                const downloadURL = await getDownloadURL(ref(storage, post.storagePath));
                videoPlayer.src = downloadURL;
            } catch (error) {
                console.error('Error loading video:', error);
                alert('Error loading video: ' + error.message);
            }
        } else {
            document.getElementById('videoPlayerSection').style.display = 'none';
        }
        
        // Update like button and count
        await updateLikeButton(postId);
        
        // Load messages
        loadMessages(postId);
        
        // Show/hide features based on role and ownership
        const isOwner = post.ownerId === currentUser.uid;
        const isInvestor = currentUserData.role === 'investor';
        
        if (isOwner) {
            document.getElementById('meetingSection').style.display = 'none';
            document.getElementById('messageSection').innerHTML = '<p>This is your post. Investors can message you here.</p>';
        } else if (isInvestor) {
            document.getElementById('meetingSection').style.display = 'block';
            document.getElementById('messageSection').style.display = 'block';
        } else {
            document.getElementById('meetingSection').style.display = 'none';
        }
        
    } catch (error) {
        console.error('Error loading post:', error);
        alert('Error loading post: ' + error.message);
    }
}

function hidePostDetail() {
    document.getElementById('postDetailSection').style.display = 'none';
    document.getElementById('feedSection').style.display = 'block';
}

// Like system
async function updateLikeButton(postId) {
    try {
        // Get post data for like count
        const postDoc = await getDoc(doc(db, 'posts', postId));
        if (postDoc.exists()) {
            const likeCount = postDoc.data().likesCount || 0;
            document.getElementById('likeCount').textContent = likeCount;
        }
        
        // Check if user has already liked this post
        const likeId = `${postId}_${currentUser.uid}`;
        const likeDoc = await getDoc(doc(db, 'likes', likeId));
        
        const likeBtn = document.getElementById('likeBtn');
        if (likeDoc.exists()) {
            likeBtn.textContent = 'Unlike';
            likeBtn.style.backgroundColor = '#ffcccc';
        } else {
            likeBtn.textContent = 'Like';
            likeBtn.style.backgroundColor = '';
        }
    } catch (error) {
        console.error('Error updating like button:', error);
    }
}

async function toggleLike() {
    if (!currentPostId) return;
    
    try {
        const likeId = `${currentPostId}_${currentUser.uid}`;
        const likeDocRef = doc(db, 'likes', likeId);
        const postDocRef = doc(db, 'posts', currentPostId);
        
        await runTransaction(db, async (transaction) => {
            const likeDoc = await transaction.get(likeDocRef);
            const postDoc = await transaction.get(postDocRef);
            
            if (!postDoc.exists()) {
                throw new Error('Post does not exist!');
            }
            
            const currentLikes = postDoc.data().likesCount || 0;
            
            if (likeDoc.exists()) {
                // Unlike
                transaction.delete(likeDocRef);
                transaction.update(postDocRef, { likesCount: Math.max(0, currentLikes - 1) });
            } else {
                // Like
                transaction.set(likeDocRef, {
                    postId: currentPostId,
                    userId: currentUser.uid,
                    likedAt: serverTimestamp()
                });
                transaction.update(postDocRef, { likesCount: currentLikes + 1 });
            }
        });
        
        console.log('Like toggled successfully');
        
        // Update UI
        await updateLikeButton(currentPostId);
        
    } catch (error) {
        console.error('Error toggling like:', error);
        alert('Error toggling like: ' + error.message);
    }
}

// Messaging system
async function loadMessages(postId) {
    try {
        const q = query(
            collection(db, 'messages'),
            where('postId', '==', postId),
            orderBy('createdAt', 'asc')
        );
        const querySnapshot = await getDocs(q);
        
        const messagesContainer = document.getElementById('messagesContainer');
        messagesContainer.innerHTML = '';
        
        if (querySnapshot.empty) {
            messagesContainer.innerHTML = '<p>No messages yet. Be the first to start a conversation!</p>';
            return;
        }
        
        querySnapshot.forEach((doc) => {
            const message = doc.data();
            const messageDiv = document.createElement('div');
            messageDiv.style.border = '1px solid #eee';
            messageDiv.style.padding = '10px';
            messageDiv.style.margin = '5px 0';
            messageDiv.style.backgroundColor = '#f0f0f0';
            
            const messageTime = message.createdAt ? new Date(message.createdAt.toDate()).toLocaleString() : 'Just now';
            
            messageDiv.innerHTML = `
                <strong>From User: ${message.fromUserId.substring(0, 8)}...</strong>
                <p>${message.text}</p>
                <small>${messageTime}</small>
            `;
            
            messagesContainer.appendChild(messageDiv);
        });
        
    } catch (error) {
        console.error('Error loading messages:', error);
    }
}

async function sendMessage() {
    const messageText = document.getElementById('messageText').value.trim();
    
    if (!messageText || !currentPostId) {
        alert('Please enter a message');
        return;
    }
    
    try {
        // Get post owner
        const postDoc = await getDoc(doc(db, 'posts', currentPostId));
        if (!postDoc.exists()) {
            alert('Post not found');
            return;
        }
        
        const post = postDoc.data();
        
        await addDoc(collection(db, 'messages'), {
            fromUserId: currentUser.uid,
            toUserId: post.ownerId,
            postId: currentPostId,
            text: messageText,
            createdAt: serverTimestamp()
        });
        
        document.getElementById('messageText').value = '';
        alert('Message sent successfully!');
        
        // Reload messages
        loadMessages(currentPostId);
        
    } catch (error) {
        console.error('Error sending message:', error);
        alert('Error sending message: ' + error.message);
    }
}

// Meeting arrangement
async function arrangeMeeting() {
    if (!currentPostId) {
        alert('No post selected');
        return;
    }
    
    try {
        // Get post data
        const postDoc = await getDoc(doc(db, 'posts', currentPostId));
        if (!postDoc.exists()) {
            alert('Post not found');
            return;
        }
        
        const post = postDoc.data();
        
        // Get founder data
        const founderDoc = await getDoc(doc(db, 'users', post.ownerId));
        if (!founderDoc.exists()) {
            alert('Founder data not found');
            return;
        }
        
        const founder = founderDoc.data();
        
        // Create meeting document
        const meetingData = {
            fromUserId: currentUser.uid,
            toUserId: post.ownerId,
            postId: currentPostId,
            status: 'arranged',
            notes: '',
            createdAt: serverTimestamp()
        };
        
        await addDoc(collection(db, 'meetings'), meetingData);
        
        // Create email content
        const subject = `Meeting Request - ${post.title}`;
        const body = `Dear Team,

A new meeting has been arranged:

Investor: ${currentUserData.displayName} (${currentUserData.email})
Founder: ${founder.displayName} (${founder.email})
Post: ${post.title}
Requested at: ${new Date().toLocaleString()}

Please coordinate the meeting details.

Best regards,
GrindPay Platform`;
        
        // Use mailto as fallback for email sending
        const mailtoLink = `mailto:jindalarchit70@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        window.open(mailtoLink);
        
        alert('Meeting request created and email notification opened!');
        
    } catch (error) {
        console.error('Error arranging meeting:', error);
        alert('Error arranging meeting: ' + error.message);
    }
}

// Dashboard functionality
async function loadDashboard() {
    try {
        console.log('Loading dashboard for founder:', currentUser.uid);
        
        // Load user's posts
        const q = query(
            collection(db, 'posts'),
            where('ownerId', '==', currentUser.uid)
        );
        const querySnapshot = await getDocs(q);
        
        let totalUploads = 0;
        let totalLikes = 0;
        const myPosts = [];
        
        querySnapshot.forEach((doc) => {
            const post = { id: doc.id, ...doc.data() };
            myPosts.push(post);
            totalUploads++;
            totalLikes += post.likesCount || 0;
        });
        
        console.log(`Dashboard stats: ${totalUploads} uploads, ${totalLikes} total likes`);
        
        // Update dashboard stats
        document.getElementById('totalUploads').textContent = totalUploads;
        document.getElementById('totalLikes').textContent = totalLikes;
        
        // Load meeting stats from user document
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists()) {
            const userData = userDoc.data();
            document.getElementById('meetingsArranged').value = userData.meetingsArranged || 0;
            document.getElementById('meetingsSuccessful').value = userData.meetingsSuccessful || 0;
        }
        
        // Display user's posts
        const myPostsList = document.getElementById('myPostsList');
        myPostsList.innerHTML = '';
        
        if (myPosts.length === 0) {
            myPostsList.innerHTML = '<p>No posts yet. <a href="#" onclick="showUpload()">Create your first post!</a></p>';
        } else {
            myPosts.forEach(post => {
                const postDiv = document.createElement('div');
                postDiv.style.border = '1px solid #ccc';
                postDiv.style.padding = '10px';
                postDiv.style.margin = '10px 0';
                postDiv.style.backgroundColor = '#f9f9f9';
                
                const createdDate = post.createdAt ? new Date(post.createdAt.toDate()).toLocaleDateString() : 'Unknown';
                
                postDiv.innerHTML = `
                    <h4>${post.title}</h4>
                    <p><strong>Type:</strong> ${post.type} | <strong>Likes:</strong> ${post.likesCount || 0} | <strong>Created:</strong> ${createdDate}</p>
                    <p>${post.description.substring(0, 100)}${post.description.length > 100 ? '...' : ''}</p>
                    <button onclick="viewPost('${post.id}')">View Details</button>
                `;
                
                myPostsList.appendChild(postDiv);
            });
        }
        
    } catch (error) {
        console.error('Error loading dashboard:', error);
        alert('Error loading dashboard: ' + error.message);
    }
}

async function updateMeetingStats() {
    try {
        const meetingsArranged = parseInt(document.getElementById('meetingsArranged').value) || 0;
        const meetingsSuccessful = parseInt(document.getElementById('meetingsSuccessful').value) || 0;
        
        if (meetingsSuccessful > meetingsArranged) {
            alert('Successful meetings cannot exceed arranged meetings');
            return;
        }
        
        await updateDoc(doc(db, 'users', currentUser.uid), {
            meetingsArranged: meetingsArranged,
            meetingsSuccessful: meetingsSuccessful
        });
        
        alert('Meeting stats updated successfully!');
    } catch (error) {
        console.error('Error updating meeting stats:', error);
        alert('Error updating meeting stats: ' + error.message);
    }
}

// Courses functionality
async function initializeCourses() {
    try {
        // Check if courses already exist
        const coursesSnapshot = await getDocs(collection(db, 'courses'));
        if (coursesSnapshot.empty) {
            console.log('Initializing sample courses...');
            // Add sample courses
            for (const course of sampleCourses) {
                await setDoc(doc(db, 'courses', course.id), course);
            }
            console.log('Sample courses added to Firestore');
        }
    } catch (error) {
        console.error('Error initializing courses:', error);
    }
}

async function loadCourses() {
    try {
        console.log('Loading courses...');
        const querySnapshot = await getDocs(collection(db, 'courses'));
        const coursesList = document.getElementById('coursesList');
        coursesList.innerHTML = '';
        
        if (querySnapshot.empty) {
            coursesList.innerHTML = '<p>No courses available at the moment.</p>';
            return;
        }
        
        querySnapshot.forEach((doc) => {
            const course = doc.data();
            const courseDiv = document.createElement('div');
            courseDiv.style.border = '2px solid #ddd';
            courseDiv.style.padding = '20px';
            courseDiv.style.margin = '15px 0';
            courseDiv.style.backgroundColor = '#f9f9f9';
            courseDiv.style.borderRadius = '8px';
            
            courseDiv.innerHTML = `
                <h3>${course.title}</h3>
                <p>${course.description}</p>
                <p><strong>Price: ${course.price}</strong></p>
                <button onclick="buyCourse('${course.id}')" style="padding: 10px 20px; font-size: 16px;">Buy Course</button>
            `;
            
            coursesList.appendChild(courseDiv);
        });
        
        console.log('Courses loaded successfully');
        
    } catch (error) {
        console.error('Error loading courses:', error);
        alert('Error loading courses: ' + error.message);
    }
}

function buyCourse(courseId) {
    console.log('Buy course clicked for:', courseId);
    alert('Razorpay integration will be added later');
}

// Utility functions
function showLoading(show) {
    document.getElementById('loading').style.display = show ? 'block' : 'none';
}

// Make functions globally available
window.signUp = signUp;
window.signIn = signIn;
window.logout = logout;
window.showFeed = showFeed;
window.showUpload = showUpload;
window.showDashboard = showDashboard;
window.showCourses = showCourses;
window.toggleUploadFields = toggleUploadFields;
window.createPost = createPost;
window.viewPost = viewPost;
window.hidePostDetail = hidePostDetail;
window.toggleLike = toggleLike;
window.sendMessage = sendMessage;
window.arrangeMeeting = arrangeMeeting;
window.updateMeetingStats = updateMeetingStats;
window.buyCourse = buyCourse;
window.searchPosts = searchPosts;
window.sortPosts = sortPosts;
window.loadMorePosts = loadMorePosts;


FIREBASE CLOUD FUNCTION FOR EMAIL SENDING:
Deploy this function to Firebase Functions to enable real email sending:

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');

admin.initializeApp();

// Configure your SMTP settings
const transporter = nodemailer.createTransporter({
    service: 'gmail',
    auth: {
        user: 'your-email@gmail.com',
        pass: 'your-app-password'
    }
});

exports.sendMeetingEmail = functions.firestore
    .document('meetings/{meetingId}')
    .onCreate(async (snap, context) => {
        const meeting = snap.data();
        
        try {
            // Get user data
            const [investorDoc, founderDoc, postDoc] = await Promise.all([
                admin.firestore().collection('users').doc(meeting.fromUserId).get(),
                admin.firestore().collection('users').doc(meeting.toUserId).get(),
                admin.firestore().collection('posts').doc(meeting.postId).get()
            ]);
            
            const investor = investorDoc.data();
            const founder = founderDoc.data();
            const post = postDoc.data();
            
            const mailOptions = {
                from: 'your-email@gmail.com',
                to: 'jindalarchit70@gmail.com',
                subject: `Meeting Request - ${post.title}`,
                html: `
                    <h2>New Meeting Request</h2>
                    <p><strong>Investor:</strong> ${investor.displayName} (${investor.email})</p>
                    <p><strong>Founder:</strong> ${founder.displayName} (${founder.email})</p>
                    <p><strong>Post:</strong> ${post.title}</p>
                    <p><strong>Requested at:</strong> ${new Date().toLocaleString()}</p>
                `
            };
            
            await transporter.sendMail(mailOptions);
            console.log('Meeting email sent successfully');
            
        } catch (error) {
            console.error('Error sending meeting email:', error);
        }
    });

To deploy:
1. npm install -g firebase-tools
2. firebase login
3. firebase init functions
4. cd functions && npm install nodemailer
5. Replace index.js with the above code
6. firebase deploy --only functions
*/
