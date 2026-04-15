#[cfg(target_os = "macos")]
use libc::{c_char, c_void, kern_return_t, mach_port_t, size_t};
#[cfg(target_os = "macos")]
use mach2::traps::mach_task_self;
#[cfg(target_os = "macos")]
use std::ffi::CString;

#[cfg(target_os = "macos")]
type IoObject = mach_port_t;
#[cfg(target_os = "macos")]
type IoIterator = IoObject;
#[cfg(target_os = "macos")]
type IoService = IoObject;
#[cfg(target_os = "macos")]
type IoConnect = IoObject;
#[cfg(target_os = "macos")]
type CFMutableDictionaryRef = *mut c_void;

#[cfg(target_os = "macos")]
const KERNEL_INDEX_SMC: u32 = 2;
#[cfg(target_os = "macos")]
const SMC_CMD_READ_BYTES: u8 = 5;
#[cfg(target_os = "macos")]
const SMC_CMD_READ_KEYINFO: u8 = 9;
#[cfg(target_os = "macos")]
const SMC_MAX_DATA_SIZE: usize = 32;
#[cfg(target_os = "macos")]
const KIO_RETURN_SUCCESS: kern_return_t = 0;
#[cfg(target_os = "macos")]
const MACH_PORT_NULL: mach_port_t = 0;

#[cfg(target_os = "macos")]
#[repr(C)]
#[derive(Clone, Copy, Default)]
struct SMCKeyDataVers {
    major: u8,
    minor: u8,
    build: u8,
    reserved: u8,
    release: u16,
}

#[cfg(target_os = "macos")]
#[repr(C)]
#[derive(Clone, Copy, Default)]
struct SMCKeyDataPLimitData {
    version: u16,
    length: u16,
    cpu_plimit: u32,
    gpu_plimit: u32,
    mem_plimit: u32,
}

#[cfg(target_os = "macos")]
#[repr(C)]
#[derive(Clone, Copy, Default)]
struct SMCKeyDataKeyInfo {
    data_size: u32,
    data_type: u32,
    data_attributes: u8,
}

#[cfg(target_os = "macos")]
#[repr(C)]
#[derive(Clone, Copy)]
struct SMCKeyData {
    key: u32,
    vers: SMCKeyDataVers,
    p_limit_data: SMCKeyDataPLimitData,
    key_info: SMCKeyDataKeyInfo,
    result: u8,
    status: u8,
    data8: u8,
    data32: u32,
    bytes: [u8; SMC_MAX_DATA_SIZE],
}

#[cfg(target_os = "macos")]
impl Default for SMCKeyData {
    fn default() -> Self {
        Self {
            key: 0,
            vers: SMCKeyDataVers::default(),
            p_limit_data: SMCKeyDataPLimitData::default(),
            key_info: SMCKeyDataKeyInfo::default(),
            result: 0,
            status: 0,
            data8: 0,
            data32: 0,
            bytes: [0; SMC_MAX_DATA_SIZE],
        }
    }
}

#[cfg(target_os = "macos")]
#[link(name = "IOKit", kind = "framework")]
extern "C" {
    fn IOMainPort(bootstrap_port: mach_port_t, main_port: *mut mach_port_t) -> kern_return_t;
    fn IOServiceMatching(name: *const c_char) -> CFMutableDictionaryRef;
    fn IOServiceGetMatchingServices(
        master_port: mach_port_t,
        matching: CFMutableDictionaryRef,
        existing: *mut IoIterator,
    ) -> kern_return_t;
    fn IOIteratorNext(iterator: IoIterator) -> IoObject;
    fn IOObjectRelease(object: IoObject) -> kern_return_t;
    fn IOServiceOpen(
        service: IoService,
        owning_task: mach_port_t,
        r#type: u32,
        connect: *mut IoConnect,
    ) -> kern_return_t;
    fn IOServiceClose(connect: IoConnect) -> kern_return_t;
    fn IOConnectCallStructMethod(
        connection: IoConnect,
        selector: u32,
        input_struct: *const c_void,
        input_struct_cnt: size_t,
        output_struct: *mut c_void,
        output_struct_cnt: *mut size_t,
    ) -> kern_return_t;
}

#[cfg(target_os = "macos")]
#[derive(Clone)]
pub struct AppleSmcFanSample {
    pub fan_count: usize,
    pub current_rpm: f64,
    pub min_rpm: Option<f64>,
    pub max_rpm: Option<f64>,
}

#[cfg(target_os = "macos")]
struct AppleSmcConnection {
    connection: IoConnect,
}

#[cfg(target_os = "macos")]
impl Drop for AppleSmcConnection {
    fn drop(&mut self) {
        unsafe {
            let _ = IOServiceClose(self.connection);
        }
    }
}

#[cfg(target_os = "macos")]
fn four_cc(key: &str) -> Result<u32, String> {
    let bytes = key.as_bytes();
    if bytes.len() != 4 {
        return Err(format!("invalid SMC key length for {key}"));
    }

    Ok(((bytes[0] as u32) << 24) | ((bytes[1] as u32) << 16) | ((bytes[2] as u32) << 8) | bytes[3] as u32)
}

#[cfg(target_os = "macos")]
fn four_cc_to_string(value: u32) -> String {
    let bytes = [
        ((value >> 24) & 0xff) as u8,
        ((value >> 16) & 0xff) as u8,
        ((value >> 8) & 0xff) as u8,
        (value & 0xff) as u8,
    ];
    String::from_utf8_lossy(&bytes).to_string()
}

#[cfg(target_os = "macos")]
fn decode_smc_numeric_value(data_type: &str, bytes: &[u8]) -> Option<f64> {
    match data_type {
        "ui8 " => bytes.first().map(|value| *value as f64),
        "ui16" => bytes.get(0..2).map(|slice| u16::from_be_bytes([slice[0], slice[1]]) as f64),
        "ui32" => bytes.get(0..4).map(|slice| u32::from_be_bytes([slice[0], slice[1], slice[2], slice[3]]) as f64),
        "flt " => bytes.get(0..4).map(|slice| f32::from_ne_bytes([slice[0], slice[1], slice[2], slice[3]]) as f64),
        "fpe2" => bytes.get(0..2).map(|slice| (((slice[0] as u16) << 6) + ((slice[1] as u16) >> 2)) as f64),
        "sp78" => bytes.get(0..2).map(|slice| i16::from_be_bytes([slice[0], slice[1]]) as f64 / 256.0),
        "sp5a" => bytes.get(0..2).map(|slice| u16::from_be_bytes([slice[0], slice[1]]) as f64 / 1024.0),
        "sp69" => bytes.get(0..2).map(|slice| u16::from_be_bytes([slice[0], slice[1]]) as f64 / 512.0),
        _ => None,
    }
}

#[cfg(target_os = "macos")]
fn open_apple_smc() -> Result<AppleSmcConnection, String> {
    let mut master_port: mach_port_t = 0;
    let result = unsafe { IOMainPort(MACH_PORT_NULL, &mut master_port) };
    if result != KIO_RETURN_SUCCESS {
        return Err(format!("IOMainPort failed with status {result}"));
    }

    let service_name = CString::new("AppleSMC").map_err(|_| "AppleSMC CString conversion failed".to_string())?;
    let matching = unsafe { IOServiceMatching(service_name.as_ptr()) };
    if matching.is_null() {
        return Err("IOServiceMatching(AppleSMC) returned null".to_string());
    }

    let mut iterator: IoIterator = 0;
    let result = unsafe { IOServiceGetMatchingServices(master_port, matching, &mut iterator) };
    if result != KIO_RETURN_SUCCESS {
        return Err(format!("IOServiceGetMatchingServices failed with status {result}"));
    }

    let device = unsafe { IOIteratorNext(iterator) };
    unsafe {
        let _ = IOObjectRelease(iterator);
    }
    if device == 0 {
        return Err("AppleSMC service was not found on this host".to_string());
    }

    let mut connection: IoConnect = 0;
    let result = unsafe { IOServiceOpen(device, mach_task_self(), 0, &mut connection) };
    unsafe {
        let _ = IOObjectRelease(device);
    }
    if result != KIO_RETURN_SUCCESS {
        return Err(format!("IOServiceOpen(AppleSMC) failed with status {result}"));
    }

    Ok(AppleSmcConnection { connection })
}

#[cfg(target_os = "macos")]
fn smc_call(connection: IoConnect, input: &SMCKeyData, output: &mut SMCKeyData) -> Result<(), String> {
    let mut output_size = std::mem::size_of::<SMCKeyData>();
    let result = unsafe {
        IOConnectCallStructMethod(
            connection,
            KERNEL_INDEX_SMC,
            input as *const _ as *const c_void,
            std::mem::size_of::<SMCKeyData>(),
            output as *mut _ as *mut c_void,
            &mut output_size,
        )
    };
    if result != KIO_RETURN_SUCCESS {
        return Err(format!("IOConnectCallStructMethod failed with status {result}"));
    }
    Ok(())
}

#[cfg(target_os = "macos")]
fn read_smc_key(connection: IoConnect, key: &str) -> Result<(String, Vec<u8>), String> {
    let mut key_info_request = SMCKeyData::default();
    let mut key_info_response = SMCKeyData::default();
    key_info_request.key = four_cc(key)?;
    key_info_request.data8 = SMC_CMD_READ_KEYINFO;
    smc_call(connection, &key_info_request, &mut key_info_response)?;

    let data_size = key_info_response.key_info.data_size as usize;
    if data_size == 0 || data_size > SMC_MAX_DATA_SIZE {
        return Err(format!("AppleSMC returned an invalid data size for key {key}"));
    }

    let mut read_request = SMCKeyData::default();
    let mut read_response = SMCKeyData::default();
    read_request.key = four_cc(key)?;
    read_request.key_info.data_size = data_size as u32;
    read_request.data8 = SMC_CMD_READ_BYTES;
    smc_call(connection, &read_request, &mut read_response)?;

    let data_type = four_cc_to_string(key_info_response.key_info.data_type);
    Ok((data_type, read_response.bytes[..data_size].to_vec()))
}

#[cfg(target_os = "macos")]
fn read_numeric_key(connection: IoConnect, key: &str) -> Result<f64, String> {
    let (data_type, bytes) = read_smc_key(connection, key)?;
    decode_smc_numeric_value(&data_type, &bytes)
        .ok_or_else(|| format!("AppleSMC key {key} used unsupported data type {data_type}"))
}

#[cfg(target_os = "macos")]
pub fn read_fan_sample() -> Result<AppleSmcFanSample, String> {
    let connection = open_apple_smc()?;
    let fan_count = read_numeric_key(connection.connection, "FNum")? as usize;
    if fan_count == 0 {
        return Err("AppleSMC reports zero fans on this host".to_string());
    }

    let current_rpm = read_numeric_key(connection.connection, "F0Ac")?;
    let min_rpm = read_numeric_key(connection.connection, "F0Mn").ok();
    let max_rpm = read_numeric_key(connection.connection, "F0Mx").ok();

    Ok(AppleSmcFanSample {
        fan_count,
        current_rpm,
        min_rpm,
        max_rpm,
    })
}

#[cfg(not(target_os = "macos"))]
#[derive(Clone)]
pub struct AppleSmcFanSample {
    pub fan_count: usize,
    pub current_rpm: f64,
    pub min_rpm: Option<f64>,
    pub max_rpm: Option<f64>,
}

#[cfg(not(target_os = "macos"))]
pub fn read_fan_sample() -> Result<AppleSmcFanSample, String> {
    Err("AppleSMC fan telemetry is only available on macOS".to_string())
}

#[cfg(test)]
mod tests {
    use super::{decode_smc_numeric_value, four_cc, four_cc_to_string};

    #[test]
    fn four_cc_roundtrips() {
        let value = four_cc("F0Ac").unwrap();
        assert_eq!(four_cc_to_string(value), "F0Ac");
    }

    #[test]
    fn decode_supported_numeric_types() {
        assert_eq!(decode_smc_numeric_value("ui8 ", &[2]), Some(2.0));
        assert_eq!(decode_smc_numeric_value("ui16", &[0x01, 0x00]), Some(256.0));
        assert_eq!(decode_smc_numeric_value("fpe2", &[0x1f, 0xfc]), Some(2047.0));
    }
}
