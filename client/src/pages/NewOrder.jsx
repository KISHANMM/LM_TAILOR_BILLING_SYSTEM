import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, ChevronDown, User, Ruler, Scissors, CreditCard, Search, Menu, Image as ImageIcon, Camera, X, Mic, Square, Trash, PenTool } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/axios';
import ScratchPad from '../components/ScratchPad';
import { saveOfflineOrder } from '../utils/offlineStore';

const SERVICE_TYPES = ['Blouse', 'Dress', 'Lehenga', 'Chudi', 'Alteration', 'Pico', 'Fall', 'Gonda', 'Krosha Work', 'Other'];

const measurementLabels = {
    BLOUSE: [
        { key: 'm_length', label: 'Length' },
        { key: 'shoulder', label: 'Shoulder' },
        { key: 'chest', label: 'Chest' },
        { key: 'waist', label: 'Waist' },
        { key: 'dot', label: 'Dot' },
        { key: 'back_neck', label: 'Back Neck' },
        { key: 'front_neck', label: 'Front Neck' },
        { key: 'sleeves_length', label: 'Sleeves Length' },
        { key: 'armhole', label: 'Armhole' },
        { key: 'chest_distance', label: 'Chest Distance' },
        { key: 'sleeves_round', label: 'Sleeves Round' },
    ],
    CHUDHIDHAR: [
        { key: 't_length', label: 'Length' },
        { key: 't_shoulder', label: 'Shoulder' },
        { key: 't_chest', label: 'Chest' },
        { key: 't_waist', label: 'Waist' },
        { key: 't_back_neck', label: 'Back Neck' },
        { key: 't_front_neck', label: 'Front Neck' },
        { key: 't_sleeves_length', label: 'Sleeves Length' },
        { key: 't_sleeves_round', label: 'Round' },
        { key: 't_half_body', label: 'Half Body' },
        { key: 't_hip', label: 'HIP' },
        { key: 'b_length', label: 'B-Length (BL)' },
        { key: 'b_bottom_round', label: 'B-Round (BR)' },
        { key: 'b_hip', label: 'B-Hip (HP)' },
        { key: 'b_fly', label: 'B-Fly (FLY)' },
        { key: 'b_thai', label: 'B-Thai' },
        { key: 'b_knee', label: 'B-Knee' },
    ]
};

const ALL_MEASUREMENT_KEYS = [
    ...measurementLabels.BLOUSE.map(f => f.key),
    ...measurementLabels.CHUDHIDHAR.map(f => f.key),
];

const initialService = () => ({ service_type: 'Blouse', quantity: 1, price: '', custom_type: '' });

export default function NewOrder({ onMenuClick, auth }) {
    const navigate = useNavigate();
    const phoneRef = useRef();

    const [initialDraft] = useState(() => {
        try {
            const d = localStorage.getItem('newOrderDraft');
            return d ? JSON.parse(d) : null;
        } catch { return null; }
    });

    const today = new Date().toISOString().split('T')[0];

    // Customer
    const [customer, setCustomer] = useState(initialDraft?.customer || { name: '', phone_number: '', notes: '' });
    const [customerId, setCustomerId] = useState(initialDraft?.customerId ?? null);
    const [customerFound, setCustomerFound] = useState(initialDraft?.customerFound ?? false);

    // Dates & Assignment
    const [bookingDate, setBookingDate] = useState(initialDraft?.bookingDate || today);
    const [deliveryDate, setDeliveryDate] = useState(initialDraft?.deliveryDate || '');
    const [assignedWorker, setAssignedWorker] = useState(initialDraft?.assignedWorker || 'Praveen');

    // Measurements
    const [measurementType, setMeasurementType] = useState(initialDraft?.measurementType || 'Body'); // 'Body' or 'Sample'
    const [activeTab, setActiveTab] = useState(initialDraft?.activeTab || 'BLOUSE'); // 'BLOUSE', 'TOP', or 'BOTTOM'
    const [measurements, setMeasurements] = useState(initialDraft?.measurements || {
        m_length: '', shoulder: '', chest: '', waist: '', dot: '',
        back_neck: '', front_neck: '', sleeves_length: '', armhole: '',
        chest_distance: '', sleeves_round: '',
        t_length: '', t_shoulder: '', t_chest: '', t_waist: '', t_back_neck: '', t_front_neck: '', t_sleeves_length: '', t_sleeves_round: '', t_half_body: '', t_hip: '',
        b_length: '', b_bottom_round: '', b_hip: '', b_fly: '', b_thai: '', b_knee: '',
    });

    // Services
    const [services, setServices] = useState(initialDraft?.services || [initialService()]);

    // Images
    const [images, setImages] = useState(initialDraft?.images || []);

    // Payment
    const [advancePaid, setAdvancePaid] = useState(initialDraft?.advancePaid || '');
    const [paymentMethod, setPaymentMethod] = useState(initialDraft?.paymentMethod || 'Cash'); // 'Cash' or 'PhonePe'

    // Voice Note
    const [isRecording, setIsRecording] = useState(false);
    const [showScratchPad, setShowScratchPad] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [audioBlob, setAudioBlob] = useState(null);
    const [audioUrl, setAudioUrl] = useState(null);

    const mediaRecorderRef = useRef(null);
    const cameraInputRef = useRef(null);
    const audioChunksRef = useRef([]);
    const timerRef = useRef(null);
    const submittingRef = useRef(false); // sync guard against double-submit

    const [loading, setLoading] = useState(false);
    const [searchLoading, setSearchLoading] = useState(false);

    // ── Image Viewer State ────────────────────────────
    const [selectedImage, setSelectedImage] = useState(null);

    // ── Draft Persistence ─────────────────────────────
    useEffect(() => {
        const draft = {
            customer, customerId, customerFound, bookingDate, deliveryDate, assignedWorker, measurementType, activeTab, measurements, services, images, advancePaid, paymentMethod
        };
        localStorage.setItem('newOrderDraft', JSON.stringify(draft));
    }, [customer, customerId, customerFound, bookingDate, deliveryDate, assignedWorker, measurementType, activeTab, measurements, services, images, advancePaid, paymentMethod]);

    // ── Computed totals ───────────────────────────────
    const totalAmount = services.reduce((s, svc) => {
        const qty = parseFloat(svc.quantity) || 0;
        const price = parseFloat(svc.price) || 0;
        return s + qty * price;
    }, 0);

    const advance = parseFloat(advancePaid) || 0;
    const balance = totalAmount - advance;

    // ── Customer lookup ───────────────────────────────
    async function handlePhoneSearch(isAuto = false) {
        if (!customer.phone_number || customer.phone_number.length < 10) {
            if (!isAuto) toast.error('Enter a valid 10-digit phone number');
            return;
        }
        setSearchLoading(true);
        try {
            const res = await api.get(`/customers/search?phone=${customer.phone_number}`);
            if (res.data && res.data.length > 0) {
                const found = res.data[0];
                setCustomerId(found.id);
                setCustomer({ name: found.name, phone_number: found.phone_number, notes: '' });
                setCustomerFound(true);
                // Prefill measurements
                const m = {};
                ALL_MEASUREMENT_KEYS.forEach(k => { 
                    m[k] = found[k] !== null && found[k] !== undefined ? String(found[k] ?? '') : ''; 
                });
                setMeasurements(m);
                toast.success(`Customer found: ${found.name}`);
            } else {
                setCustomerFound(false);
                setCustomerId(null);
                toast('New customer — fill in the details below', { icon: '👤' });
            }
        } catch {
            toast.error('Search failed');
        } finally {
            setSearchLoading(false);
        }
    }

    // Auto-search when 10 digits are entered
    useEffect(() => {
        console.log('Phone number changed:', customer.phone_number, 'Length:', customer.phone_number.length, 'Found:', customerFound);
        if (customer.phone_number.length === 10 && !customerFound) {
            console.log('Triggering auto-search...');
            handlePhoneSearch(true);
        } else if (customer.phone_number.length < 10 && customerFound) {
            console.log('Resetting customer found (number short)');
            setCustomerFound(false);
            setCustomerId(null);
            // Optional: reset name if it was prefilled and now user is typing a new number
            // setCustomer(c => ({ ...c, name: '' }));
        }
    }, [customer.phone_number, customerFound]);

    // ── Service helpers ───────────────────────────────
    function addService() { setServices(s => [...s, initialService()]); }
    function removeService(i) { setServices(s => s.filter((_, idx) => idx !== i)); }
    function updateService(i, field, val) {
        setServices(s => s.map((svc, idx) => idx === i ? { ...svc, [field]: val } : svc));
    }

    // ── Voice Note ────────────────────────────────────
    const stopRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop();
        }
        setIsRecording(false);
        clearInterval(timerRef.current);
    };

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorderRef.current = new MediaRecorder(stream);
            audioChunksRef.current = [];

            mediaRecorderRef.current.ondataavailable = (e) => {
                if (e.data.size > 0) audioChunksRef.current.push(e.data);
            };

            mediaRecorderRef.current.onstop = () => {
                const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                setAudioBlob(blob);
                setAudioUrl(URL.createObjectURL(blob));
                // stop microphone access
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorderRef.current.start();
            setIsRecording(true);
            setRecordingTime(0);

            timerRef.current = setInterval(() => {
                setRecordingTime(prev => {
                    if (prev >= 119) {
                        stopRecording();
                        return 120;
                    }
                    return prev + 1;
                });
            }, 1000);
        } catch (err) {
            toast.error('Microphone access denied or unavailable');
        }
    };

    const clearAudio = () => {
        setAudioBlob(null);
        setAudioUrl(null);
        setRecordingTime(0);
    };

    const blobToBase64 = (blob) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    };

    // ── Image handle ──────────────────────────────────
    const handleImageUpload = (e) => {
        const files = Array.from(e.target.files);
        files.forEach(file => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target.result;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const MAX_WIDTH = 800;
                    let width = img.width;
                    let height = img.height;

                    if (width > MAX_WIDTH) {
                        height = Math.round((height * MAX_WIDTH) / width);
                        width = MAX_WIDTH;
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    const base64Str = canvas.toDataURL('image/jpeg', 0.7);
                    setImages(prev => [...prev, base64Str]);
                };
            };
        });
        e.target.value = null; // reset input
    };

    const removeImage = (index) => {
        setImages(images.filter((_, i) => i !== index));
    };

    const handleScratchSave = (base64) => {
        setImages(prev => [...prev, base64]);
        toast.success('Sketch saved and added to images');
    };

    // ── Submit ────────────────────────────────────────
    async function handleSubmit(e) {
        e.preventDefault();
        // Guard: block duplicate submissions from double-clicks
        if (submittingRef.current) return;
        submittingRef.current = true;
        if (!customer.name || !customer.phone_number) { submittingRef.current = false; return toast.error('Customer name and phone are required'); }
        if (!deliveryDate) { submittingRef.current = false; return toast.error('Please set a delivery date'); }
        if (services.some(s => !s.price || parseFloat(s.price) <= 0)) { submittingRef.current = false; return toast.error('All services must have a price'); }

        // Requirement: Measurements mandatory for Blouse (IF using Body Measurements)
        const hasBlouse = services.some(s => s.service_type === 'Blouse');
        if (hasBlouse && measurementType === 'Body') {
            const missing = measurementLabels.BLOUSE.find(f => !measurements[f.key] || measurements[f.key] === '');
            if (missing) {
                submittingRef.current = false;
                setActiveTab('BLOUSE');
                setTimeout(() => {
                    const el = document.getElementById(`meas_input_${missing.key}`);
                    if (el) {
                        el.focus();
                        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                }, 100);
                return toast.error(`Enter ${missing.label}`);
            }
        }

        const isOffline = !navigator.onLine;
        
        // Prepare data payloads
        const measPayload = {};
        ALL_MEASUREMENT_KEYS.forEach(k => { if (measurements[k]) measPayload[k] = parseFloat(measurements[k]); });

        const svcList = services.map(s => ({
            service_type: s.service_type === 'Other' ? (s.custom_type || 'Other') : s.service_type,
            quantity: parseInt(s.quantity) || 1,
            price: parseFloat(s.price),
        }));

        const orderPayload = {
            booking_date: bookingDate,
            delivery_date: deliveryDate,
            advance_paid: advance,
            notes: customer.notes || '',
            measurement_type: measurementType,
            services: svcList,
            assigned_worker: assignedWorker,
            payment_method: paymentMethod,
        };

        if (isOffline) {
            setLoading(true);
            try {
                const audioData = audioBlob ? await blobToBase64(audioBlob) : null;
                const offlineData = {
                    customer_id: customerId,
                    customer: !customerId ? { name: customer.name, phone_number: customer.phone_number } : undefined,
                    measPayload,
                    orderPayload,
                    images: images.length > 0 ? images : [],
                    audioData,
                    recordingTime: audioBlob ? recordingTime : null
                };

                const insertId = await saveOfflineOrder(offlineData);
                toast.success('Offline mode: Order saved locally! It will sync when internet is back.', { duration: 5000 });
                localStorage.removeItem('newOrderDraft');
                
                if (auth?.role === 'Worker') {
                    navigate('/');
                } else {
                    navigate(`/bill/offline-${insertId}`);
                }
            } catch (err) {
                toast.error('Failed to save offline order');
            } finally {
                setLoading(false);
                submittingRef.current = false;
            }
            return;
        }

        setLoading(true);
        try {
            const audioData = audioBlob ? await blobToBase64(audioBlob) : null;
            
            const finalPayload = {
                ...orderPayload,
                customer_id: customerId,
                customer: !customerId ? { name: customer.name, phone_number: customer.phone_number } : undefined,
                measurements: Object.keys(measPayload).length > 0 ? measPayload : undefined,
                images: images.length > 0 ? images : undefined,
                audio_data: audioData,
                recordingTime: audioBlob ? recordingTime : undefined
            };

            const orderRes = await api.post('/orders', finalPayload);
            const createdOrderId = orderRes.data.order_id;

            toast.success('Order created successfully!');
            localStorage.removeItem('newOrderDraft');
            if (auth?.role === 'Worker') {
                navigate('/');
            } else {
                navigate(`/bill/${createdOrderId}`);
            }
        } catch (err) {
            console.error('Order creation failed:', err);
            toast.error(err.response?.data?.error || 'Failed to create order');
            submittingRef.current = false; // allow retry on error
        } finally {
            setLoading(false);
        }
    }

    return (
        <div>
            {/* ── Full-screen loading overlay when creating order ── */}
            {loading && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    zIndex: 9999,
                    background: 'rgba(20, 5, 9, 0.95)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 20,
                }}>
                    {/* Spinning ring */}
                    <div style={{
                        width: 64, height: 64,
                        border: '4px solid rgba(198,167,94,0.2)',
                        borderTop: '4px solid var(--gold)',
                        borderRight: '4px solid rgba(198,167,94,0.5)',
                        borderRadius: '50%',
                        animation: 'spin 0.75s linear infinite',
                    }} />
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 18, fontWeight: 700, color: '#fff', marginBottom: 6 }}>
                            Creating Order...
                        </div>
                        <div style={{ fontSize: 13, color: 'rgba(198,167,94,0.7)', letterSpacing: '0.02em' }}>
                            Saving customer &amp; measurements · Please wait
                        </div>
                    </div>
                    {/* Pulsing dots */}
                    <div style={{ display: 'flex', gap: 6 }}>
                        {[0, 1, 2].map(i => (
                            <div key={i} style={{
                                width: 8, height: 8,
                                borderRadius: '50%',
                                background: 'var(--gold)',
                                animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
                                opacity: 0.7,
                            }} />
                        ))}
                    </div>
                    <style>{`
                        @keyframes pulse {
                            0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
                            40% { transform: scale(1); opacity: 1; }
                        }
                    `}</style>
                </div>
            )}
            {/* Top bar */}
            <div className="topbar flex-between">
                <div className="flex">
                    <button className="mobile-menu-btn" onClick={onMenuClick}>
                        <Menu size={22} />
                    </button>
                    <div>
                        <div className="topbar-title">New Order</div>
                        <div className="topbar-subtitle">Create a new tailoring order</div>
                    </div>
                </div>
            </div>

            <div className="page-container">
                <form onSubmit={handleSubmit}>

                    {/* ─── CUSTOMER DETAILS ───────────────── */}
                    <div className="card mb-16">
                        <div className="card-header">
                            <h3 className="card-title flex gap-8"><User size={18} color="var(--gold)" /> Customer Details</h3>
                        </div>
                        <div className="card-body">
                            {/* Phone search row */}
                            <div className="form-group">
                                <label className="form-label">Phone Number *</label>
                                <div className="flex gap-12">
                                    <div className="input-prefix" style={{ flex: 1 }}>
                                        <span className="prefix-symbol">+91</span>
                                        <input
                                            type="tel"
                                            ref={phoneRef}
                                            value={customer.phone_number}
                                            onChange={e => {
                                                setCustomer(c => ({ ...c, phone_number: e.target.value }));
                                                if (customerFound) setCustomerFound(false);
                                            }}
                                            placeholder="10-digit number"
                                            maxLength={10}
                                            required
                                        />
                                    </div>
                                    <button type="button" className="btn btn-outline" onClick={handlePhoneSearch} disabled={searchLoading}>
                                        <Search size={16} /> {searchLoading ? 'Searching…' : 'Search'}
                                    </button>
                                </div>
                                {customerFound && (
                                    <div className="alert alert-success mt-8" style={{ marginBottom: 0 }}>
                                        ✅ Existing customer found — measurements pre-filled
                                    </div>
                                )}
                            </div>

                            <div className="grid-2">
                                <div className="form-group">
                                    <label className="form-label">Customer Name *</label>
                                    <input
                                        className="form-input"
                                        value={customer.name}
                                        onChange={e => setCustomer(c => ({ ...c, name: e.target.value }))}
                                        placeholder="Full name"
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Notes & Voice Instructions</label>
                                    <input
                                        className="form-input"
                                        value={customer.notes}
                                        onChange={e => setCustomer(c => ({ ...c, notes: e.target.value }))}
                                        placeholder="Any special written instructions..."
                                    />
                                    <div style={{ marginTop: 8 }}>
                                        {isRecording ? (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#FFEBEE', padding: '8px 12px', borderRadius: 8, border: '1px solid #FFCDD2' }}>
                                                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#D32F2F', animation: 'blink 1s infinite' }} />
                                                <span style={{ color: '#D32F2F', fontWeight: 600, fontSize: 13, flex: 1 }}>Recording: {Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, '0')} / 2:00</span>
                                                <button type="button" onClick={stopRecording} style={{ background: '#D32F2F', color: 'white', border: 'none', borderRadius: 4, padding: '4px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                                                    <Square size={12} /> Stop
                                                </button>
                                            </div>
                                        ) : audioUrl ? (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#E8F5E9', padding: '8px 12px', borderRadius: 8, border: '1px solid #C8E6C9' }}>
                                                <audio src={audioUrl} controls style={{ height: 32, flex: 1 }} />
                                                <button type="button" onClick={clearAudio} style={{ background: 'transparent', border: 'none', color: '#D32F2F', cursor: 'pointer', padding: 4 }} title="Delete voice note">
                                                    <Trash size={16} />
                                                </button>
                                            </div>
                                        ) : (
                                            <button type="button" className="btn btn-outline btn-sm" onClick={startRecording} style={{ width: '100%', justifyContent: 'center', gap: 6 }}>
                                                <Mic size={14} color="#D32F2F" /> Record Voice Note (Max 2m)
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="grid-2">
                                <div className="form-group">
                                    <label className="form-label">Booking Date *</label>
                                    <input className="form-input" type="date" value={bookingDate}
                                        onChange={e => setBookingDate(e.target.value)} required />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Delivery Date *</label>
                                    <input className="form-input" type="date" value={deliveryDate}
                                        onChange={e => setDeliveryDate(e.target.value)} min={bookingDate} required />
                                </div>
                            </div>


                        </div>
                    </div>

                    {/* ─── MEASUREMENTS ───────────────────── */}
                    <div className="card mb-16">
                        <div className="card-header flex-between">
                            <h3 className="card-title flex gap-8"><Ruler size={18} color="var(--gold)" /> Fittings & Measurements</h3>
                            <div className="flex gap-8" style={{ background: 'var(--ivory)', padding: 4, borderRadius: 20, border: '1px solid var(--gray-light)' }}>
                                <button type="button"
                                    className={`btn btn-sm ${measurementType === 'Body' ? 'btn-primary' : 'btn-ghost'}`}
                                    style={{ borderRadius: 16 }}
                                    onClick={() => setMeasurementType('Body')}>
                                    Body Measurements
                                </button>
                                <button type="button"
                                    className={`btn btn-sm ${measurementType === 'Sample' ? 'btn-primary' : 'btn-ghost'}`}
                                    style={{ borderRadius: 16 }}
                                    onClick={() => setMeasurementType('Sample')}>
                                    Existing Blouse Piece
                                </button>
                            </div>
                        </div>
                        <div className="card-body">
                            {/* Toggle between tabs */}
                            <div className="flex gap-8 mb-20" style={{ borderBottom: '1px solid var(--gray-light)', paddingBottom: 12, overflowX: 'auto', whiteSpace: 'nowrap' }}>
                                {Object.keys(measurementLabels).map(tab => (
                                    <button type="button" key={tab}
                                        className={`btn btn-sm ${activeTab === tab ? 'btn-primary' : 'btn-outline'}`}
                                        onClick={() => setActiveTab(tab)}
                                        style={{ borderRadius: 8, minWidth: '100px' }}
                                    >
                                        {tab}
                                    </button>
                                ))}
                            </div>

                            {measurementType === 'Sample' ? (
                                <div className="alert alert-success mt-8" style={{ marginBottom: 0, textAlign: 'center' }}>
                                    ✅ Customer provided an existing fitting piece. Body measurements are not required.
                                </div>
                            ) : (
                                <div className="grid-3">
                                    {(measurementLabels[activeTab] || []).map(f => (
                                        <div className="form-group" key={f.key}>
                                            <label className="form-label">{f.label}</label>
                                            <div className="input-prefix">
                                                <span className="prefix-symbol" style={{ fontSize: 11, padding: '10px 8px' }}>inches</span>
                                                <input
                                                    id={`meas_input_${f.key}`}
                                                    type="number"
                                                    step="any"
                                                    min="0"
                                                    value={measurements[f.key] || ''}
                                                    onChange={e => setMeasurements(m => ({ ...m, [f.key]: e.target.value }))}
                                                    placeholder="0"
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ─── SERVICES ───────────────────────── */}
                    <div className="card mb-16">
                        <div className="card-header">
                            <h3 className="card-title flex gap-8"><Scissors size={18} color="var(--gold)" /> Services</h3>
                            <button type="button" className="btn btn-sm btn-outline" onClick={addService}>
                                <Plus size={14} /> Add Row
                            </button>
                        </div>
                        <div className="card-body">
                            {/* Header row */}
                            <div style={{ display: 'grid', gridTemplateColumns: '2fr 0.8fr 1.2fr auto', gap: 12, marginBottom: 8 }}>
                                <span className="form-label">Service Type</span>
                                <span className="form-label">Qty</span>
                                <span className="form-label">Price (₹)</span>
                                <span />
                            </div>

                            {services.map((svc, i) => (
                                <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 0.8fr 1.2fr auto', gap: 12, marginBottom: 12, alignItems: 'flex-start' }}>
                                    <div>
                                        <select
                                            className="form-select"
                                            value={svc.service_type}
                                            onChange={e => updateService(i, 'service_type', e.target.value)}
                                        >
                                            {SERVICE_TYPES.map(t => <option key={t}>{t}</option>)}
                                        </select>
                                        {svc.service_type === 'Other' && (
                                            <input
                                                className="form-input mt-8"
                                                placeholder="Specify service..."
                                                value={svc.custom_type}
                                                onChange={e => updateService(i, 'custom_type', e.target.value)}
                                                required
                                            />
                                        )}
                                    </div>
                                    <input
                                        className="form-input"
                                        type="number"
                                        min="1"
                                        value={svc.quantity}
                                        onChange={e => updateService(i, 'quantity', e.target.value)}
                                        required
                                    />
                                    <div className="input-prefix">
                                        <span className="prefix-symbol">₹</span>
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={svc.price}
                                            onChange={e => updateService(i, 'price', e.target.value)}
                                            placeholder="0.00"
                                            required
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        className="btn btn-sm btn-danger"
                                        onClick={() => removeService(i)}
                                        disabled={services.length === 1}
                                        style={{ padding: '10px' }}
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            ))}

                            {/* Subtotals per service */}
                            {services.length > 0 && (
                                <div style={{ background: 'var(--blush)', borderRadius: 8, padding: '12px 16px', marginTop: 8 }}>
                                    {services.map((svc, i) => {
                                        const sub = (parseFloat(svc.price) || 0) * (parseFloat(svc.quantity) || 0);
                                        return (
                                            <div key={i} className="flex-between" style={{ fontSize: 13, padding: '3px 0' }}>
                                                <span>{svc.service_type === 'Other' ? svc.custom_type || 'Other' : svc.service_type} × {svc.quantity}</span>
                                                <strong>₹{sub.toFixed(2)}</strong>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ─── DESIGN IMAGES ──────────────────── */}
                    <div className="card mb-16">
                        <div className="card-header">
                            <h3 className="card-title flex gap-8"><ImageIcon size={18} color="var(--gold)" /> Design Reference Images</h3>
                            <span className="badge" style={{ background: '#E3F2FD', color: '#1565C0', border: '1px solid #BBDEFB', fontSize: 11 }}>
                                Optional
                            </span>
                        </div>
                        <div className="card-body">
                            <div className="grid-2 gap-16" style={{ marginBottom: 16 }}>
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label">Gallery Upload</label>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        multiple
                                        onChange={handleImageUpload}
                                        className="form-input"
                                        style={{ padding: '8px' }}
                                    />
                                </div>
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label">Camera Capture</label>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        capture="environment"
                                        onChange={handleImageUpload}
                                        ref={cameraInputRef}
                                        style={{ display: 'none' }}
                                    />
                                    <button
                                        type="button"
                                        className="btn btn-outline"
                                        style={{ width: '100%', height: '42px', display: 'flex', justifyContent: 'center', gap: 8, borderColor: 'var(--gold)', color: 'var(--gold)' }}
                                        onClick={() => cameraInputRef.current?.click()}
                                    >
                                        <Camera size={18} /> Take Photo
                                    </button>
                                </div>
                                <div className="form-group" style={{ marginBottom: 0, gridColumn: 'span 2' }}>
                                    <label className="form-label">Scratch Pad (Draw Backneck Patterns)</label>
                                    <button
                                        type="button"
                                        className="btn btn-outline"
                                        style={{ width: '100%', height: '42px', display: 'flex', justifyContent: 'center', gap: 8, borderColor: 'var(--maroon)', color: 'var(--maroon)' }}
                                        onClick={() => setShowScratchPad(true)}
                                    >
                                        <PenTool size={18} /> Open Scratch Pad
                                    </button>
                                </div>
                            </div>
                            <p style={{ fontSize: 12, color: 'var(--gray)', marginTop: 4 }}>Images are automatically compressed to save space.</p>
                            {images.length > 0 && (
                                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                                    {images.map((src, i) => (
                                        <div key={i} style={{ position: 'relative', width: 100, height: 100, border: '1px solid var(--gray-light)', borderRadius: 8, overflow: 'hidden' }}>
                                            <img src={src} alt="Design preview" style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' }} onClick={() => setSelectedImage(src)} />
                                            <button
                                                type="button"
                                                onClick={() => removeImage(i)}
                                                style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', borderRadius: '50%', padding: 4, cursor: 'pointer' }}
                                            >
                                                <X size={12} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ─── PAYMENT SUMMARY ────────────────── */}
                    <div className="card mb-16">
                        <div className="card-header">
                            <h3 className="card-title flex gap-8"><CreditCard size={18} color="var(--gold)" /> Payment Summary</h3>
                        </div>
                        <div className="card-body">
                            <div className="grid-2">
                                <div>
                                    <div className="form-group">
                                        <label className="form-label">Advance Paid (₹)</label>
                                        <div className="input-prefix">
                                            <span className="prefix-symbol">₹</span>
                                            <input
                                                type="number"
                                                min="0"
                                                max={totalAmount}
                                                step="0.01"
                                                value={advancePaid}
                                                onChange={e => setAdvancePaid(e.target.value)}
                                                placeholder="0.00"
                                            />
                                        </div>
                                    </div>
                                    <div className="form-group mt-16">
                                        <label className="form-label">Payment Method</label>
                                        <select
                                            className="form-select"
                                            value={paymentMethod}
                                            onChange={e => setPaymentMethod(e.target.value)}
                                            style={{ width: '100%', padding: '10px 12px', borderRadius: '8px' }}
                                        >
                                            <option value="Cash">Cash</option>
                                            <option value="PhonePe">PhonePe</option>
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <div style={{ background: 'var(--ivory)', borderRadius: 10, padding: '16px 20px', border: '1px solid var(--gray-light)' }}>
                                        <div className="flex-between" style={{ padding: '6px 0', borderBottom: '1px solid var(--gray-light)' }}>
                                            <span style={{ color: 'var(--gray)', fontSize: 13 }}>Total Amount</span>
                                            <strong style={{ fontSize: 15 }}>₹{totalAmount.toFixed(2)}</strong>
                                        </div>
                                        <div className="flex-between" style={{ padding: '6px 0', borderBottom: '1px solid var(--gray-light)' }}>
                                            <span style={{ color: 'var(--gray)', fontSize: 13 }}>Advance Paid</span>
                                            <span style={{ color: '#2E7D32', fontWeight: 600 }}>₹{advance.toFixed(2)}</span>
                                        </div>
                                        <div className="flex-between" style={{ padding: '10px 0 0' }}>
                                            <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--maroon-dark)' }}>Balance Due</span>
                                            <strong style={{ fontSize: 18, color: balance > 0 ? '#E65100' : '#2E7D32' }}>
                                                ₹{balance.toFixed(2)}
                                            </strong>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Submit */}
                    <div className="flex gap-12" style={{ justifyContent: 'flex-end', marginTop: 8, paddingBottom: 8 }}>
                        <button type="button" className="btn btn-ghost" onClick={() => { localStorage.removeItem('newOrderDraft'); navigate('/'); }}>Cancel</button>
                        <button type="submit" className="btn btn-primary btn-lg" disabled={loading} style={{ minWidth: 200, justifyContent: 'center' }}>
                            {loading ? (
                                <><span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.4)', borderTop: '2px solid #fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />&nbsp;Creating..&nbsp;</>
                            ) : '✓ Create Order & View Bill'}
                        </button>
                    </div>

                </form>
            </div>
            
            {showScratchPad && (
                <ScratchPad 
                    onSave={handleScratchSave} 
                    onClose={() => setShowScratchPad(false)} 
                />
            )}

            {/* Fullscreen Image Modal */}
            {selectedImage && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center' }} onClick={() => setSelectedImage(null)}>
                    <img src={selectedImage} style={{ maxWidth: '90%', maxHeight: '90%', objectFit: 'contain', borderRadius: '8px' }} onClick={(e) => e.stopPropagation()} />
                    <button style={{ position: 'absolute', top: '20px', right: '20px', background: 'rgba(0,0,0,0.5)', border: 'none', color: '#fff', cursor: 'pointer', borderRadius: '50%', padding: '8px', display: 'flex' }} onClick={() => setSelectedImage(null)}>
                        <X size={24} />
                    </button>
                </div>
            )}

            <style>{`
                @keyframes blink { 50% { opacity: 0.5; } }
            `}</style>
        </div>
    );
}
